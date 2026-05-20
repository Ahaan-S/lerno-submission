/**
 * lib/ai/doc-edit-detector.ts
 *
 * Determines WHAT to edit in an existing document based on the user's message.
 * Uses chatLite (Gemini Flash Lite, cheap, ~300ms).
 * Called once at the start of every edit request.
 */

import { chatLite } from "@/lib/ai/llm";

export type EditType =
  | "add_detail"
  | "reduce"
  | "rewrite"
  | "add_topic"
  | "remove_topic";

export interface DocEdit {
  edit_type: EditType;
  // topic_indices: existing sections in the document to edit.
  // For remove_topic: the sections to remove.
  // For add_topic: empty [] (the new topics are in new_topic_indices).
  topic_indices: string[];
  // new_topic_indices / new_topic_names: only populated for add_topic.
  new_topic_indices: string[];
  new_topic_names: string[];
  // Instruction appended to the generator prompt.
  instruction: string;
}

interface SectionManifest {
  topic_index: string;
  topic_name: string;
}

/**
 * Detects what edit the user wants to make to an existing document.
 *
 * @param editMessage     The user's edit request
 * @param currentSections The sections currently in the document (topic_index + topic_name)
 * @param chapterTopics   All topics in the chapter (for add_topic detection)
 */
export async function detectDocEdit(
  editMessage: string,
  currentSections: SectionManifest[],
  chapterTopics: SectionManifest[]
): Promise<DocEdit | null> {
  const sectionList = currentSections
    .map((s) => `${s.topic_index}: ${s.topic_name}`)
    .join("\n");

  const allTopicsList = chapterTopics
    .map((t) => `${t.topic_index}: ${t.topic_name}`)
    .join("\n");

  const prompt = `
You are an edit detector for a student's NCERT study notes document.

SECTIONS CURRENTLY IN THE DOCUMENT:
${sectionList}

ALL TOPICS AVAILABLE IN THIS CHAPTER (superset of above):
${allTopicsList}

STUDENT'S EDIT REQUEST: "${editMessage}"

Determine exactly what to change. Choose ONE edit_type:
- "add_detail"   → student wants more content on a topic ALREADY in the document
- "reduce"       → student wants a topic ALREADY in the document to be shorter/condensed
- "rewrite"      → student wants a topic ALREADY in the document rewritten differently
- "add_topic"    → student wants to ADD a topic that is NOT currently in the document
- "remove_topic" → student wants to REMOVE a topic that IS currently in the document

IMPORTANT MATCHING RULES:
- Match topic names approximately: "oxidation" matches "Oxidation and Reduction"
- "add more on X" where X is in the document → add_detail (not add_topic)
- "add X" where X is NOT in the document → add_topic
- For add_detail / reduce / rewrite / remove_topic: populate topic_indices with matching existing section topic_indices
- For add_topic: topic_indices must be [], new_topic_indices must contain the chapter topic_indices to add
- instruction: a clear, specific instruction for the content generator
  Good examples:
    "Be significantly more detailed on the mechanism of oxidation. Include all examples from the textbook."
    "Condense this to the 5 most exam-critical bullet points only."
    "Rewrite with a different structure — start with a definition, then properties, then examples."

Return ONLY valid JSON. No explanation. No markdown fences.
{
  "edit_type": "add_detail",
  "topic_indices": ["1.2.5"],
  "new_topic_indices": [],
  "new_topic_names": [],
  "instruction": "Be significantly more detailed on oxidation reactions. Cover all examples."
}
`.trim();

  try {
    const raw = await chatLite([{ role: "user", content: prompt }]);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as DocEdit;
    return {
      edit_type: parsed.edit_type,
      topic_indices: parsed.topic_indices ?? [],
      new_topic_indices: parsed.new_topic_indices ?? [],
      new_topic_names: parsed.new_topic_names ?? [],
      instruction: parsed.instruction ?? "",
    };
  } catch (err) {
    console.error("[doc-edit-detector] Failed to parse edit:", err);
    return null;
  }
}
