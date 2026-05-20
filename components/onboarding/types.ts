export interface ProfileData {
    name: string;
    grade: string;
    weakSubjects: string[];
    selectedSubjects: string[]; // Step 2 (General Selection)
    topicStrengths: Record<string, string[]>; // Map subjectId -> selected chapterIds
    topicWeaknesses: Record<string, string[]>; // Map subjectId -> selected chapterIds
    learningStyle: string[];
    additionalInfo: string;
}
