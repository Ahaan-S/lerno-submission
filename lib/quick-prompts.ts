/**
 * Subject-specific quick prompt banks for the Ask mode homepage.
 * 6 prompts per task per subject, across all grades.
 *
 * Tasks: "Explain a topic" | "Make notes" | "Generate a quiz" | "Summarize a chapter"
 *
 * Usage: call getQuickPromptsForTask(grade, task, userSubjectIds) to get 6
 * randomly sampled prompts drawn from the user's active subjects.
 */

export type TaskKey = "Explain a topic" | "Make notes" | "Generate a quiz" | "Summarize a chapter";

type SubjectPromptBank = Record<TaskKey, string[]>;

// ─── Grade 10 ────────────────────────────────────────────────────────────────

const G10_SCIENCE: SubjectPromptBank = {
    "Explain a topic": [
        "Explain how acids and bases differ — properties, indicators, and pH scale",
        "What happens during chemical reactions? Explain with balanced equations",
        "How does refraction of light work? Explain with a glass slab example",
        "What is the role of the nervous system in control and coordination?",
        "Explain heredity — how are traits passed from parents to offspring?",
        "How does electricity flow in a circuit? Explain Ohm's law and resistance",
    ],
    "Make notes": [
        "Make notes on Chemical Reactions and Equations — types and balancing",
        "Notes on Acids, Bases and Salts — indicators, neutralisation, and pH",
        "Notes on Life Processes — nutrition, respiration, transport, excretion",
        "Notes on Control and Coordination — nervous system and hormones",
        "Notes on Heredity — Mendel's laws and variation",
        "Notes on Electricity — Ohm's law, resistance, power, and circuits",
    ],
    "Generate a quiz": [
        "Quiz me on Chemical Reactions and Equations",
        "10 questions on Acids, Bases and Salts",
        "Quiz on Metals and Non-metals — properties and reactions",
        "Test my knowledge of Life Processes",
        "Quiz on Heredity — Mendel's experiments and laws",
        "Quiz on Light — reflection, refraction, and lenses",
    ],
    "Summarize a chapter": [
        "Summarize Chemical Reactions and Equations",
        "Key takeaways from Acids, Bases and Salts",
        "Summarize Carbon and its Compounds",
        "Summarize Life Processes — all main points",
        "Summarize Light – Reflection and Refraction",
        "Summarize Electricity — key formulas and concepts",
    ],
};

const G10_MATH: SubjectPromptBank = {
    "Explain a topic": [
        "Explain the Fundamental Theorem of Arithmetic with examples",
        "How does the quadratic formula work? Derive it using completing the square",
        "Explain the Basic Proportionality Theorem and its converse",
        "How do you find the area of a triangle using coordinate geometry?",
        "Explain trigonometric ratios — sin, cos, and tan in a right triangle",
        "What is arithmetic progression? Explain the nth term and sum formulas",
    ],
    "Make notes": [
        "Key formulas for Real Numbers — HCF, LCM, and Euclid's algorithm",
        "Notes on Polynomials — types, zeros, and the division algorithm",
        "Notes on Quadratic Equations — factorisation, formula, and discriminant",
        "Key formulas for Arithmetic Progressions — nth term and sum",
        "Notes on Triangles — similarity criteria and Pythagoras theorem",
        "Notes on Trigonometry — all standard ratios, identities, and applications",
    ],
    "Generate a quiz": [
        "Quiz me on Real Numbers — HCF, LCM, and Euclid's lemma",
        "10 questions on Polynomials and their zeros",
        "Quiz on Quadratic Equations — all solution methods",
        "Test my knowledge of Arithmetic Progressions",
        "Quiz on Similar Triangles and the Pythagoras theorem",
        "Quiz on Introduction to Trigonometry and its identities",
    ],
    "Summarize a chapter": [
        "Summarize Real Numbers — Euclid's algorithm and the Fundamental Theorem",
        "Summarize Polynomials — zeros and relationship with coefficients",
        "Summarize Quadratic Equations — all key results",
        "Summarize Arithmetic Progressions with formulas and applications",
        "Summarize Circles — tangent properties and theorems",
        "Summarize Statistics — mean, median, and mode formulas",
    ],
};

const G10_SOCIAL: SubjectPromptBank = {
    "Explain a topic": [
        "Explain how nationalism spread across Europe after the French Revolution",
        "What were the causes and key events of the Non-Cooperation Movement?",
        "How did industrialisation change life in Britain in the 19th century?",
        "Explain the concept of federalism and how power is shared in India",
        "What is globalisation and how does it affect developing economies?",
        "Explain sustainable development — meaning, need, and Indian examples",
    ],
    "Make notes": [
        "Notes on Nationalism in India — from Rowlatt Act to Civil Disobedience",
        "Notes on The Making of a Global World — trade, migration, and colonialism",
        "Notes on Development — national income, HDI, and sustainability",
        "Notes on Money and Credit — formal vs informal credit and banking",
        "Notes on Resources and Development — types, distribution, and conservation",
        "Notes on Federalism and Democracy — power-sharing and political parties",
    ],
    "Generate a quiz": [
        "Quiz me on Nationalism in India — 10 questions",
        "Test my knowledge of The Age of Industrialisation",
        "Quiz on Federalism and Power-sharing in India",
        "Quiz on Money and Credit — banking and the credit sector",
        "10 questions on Sectors of the Indian Economy",
        "Quiz on Agriculture and Water Resources",
    ],
    "Summarize a chapter": [
        "Summarize Nationalism in India — key events and movements",
        "Summarize The Making of a Global World",
        "Summarize Development — key concepts and indicators",
        "Summarize Globalisation and the Indian Economy",
        "Summarize Resources and Development in India",
        "Summarize Political Parties — roles, types, and party systems",
    ],
};

const G10_ENGLISH: SubjectPromptBank = {
    "Explain a topic": [
        "Explain the theme and moral of 'A Letter to God'",
        "What is the central idea of the poem 'Dust of Snow' by Robert Frost?",
        "What is the theme of 'The Hack Driver' — what does it say about deception?",
        "Explain the character of Bholi and her transformation in the story",
        "What does the poem 'Fire and Ice' convey — explain the symbolism",
        "Explain the literary devices used in the poem 'Amanda!'",
    ],
    "Make notes": [
        "Notes on 'A Letter to God' — plot, theme, and characters",
        "Character analysis of Bholi — her journey and what it represents",
        "Notes on the poems in First Flight — themes and literary devices",
        "Notes on 'The Hack Driver' — plot, irony, and moral",
        "Summary notes on Footprints without Feet — all prose chapters",
        "Notes on 'The Diary of a Young Girl' — Anne Frank's story and themes",
    ],
    "Generate a quiz": [
        "Quiz me on 'A Letter to God' — characters, events, and theme",
        "10 questions on the poems in First Flight",
        "Quiz on 'Bholi' — plot, character, and message",
        "Test my comprehension of 'The Hack Driver'",
        "Quiz on all prose chapters of First Flight",
        "Quiz on Footprints without Feet — key chapters",
    ],
    "Summarize a chapter": [
        "Summarize 'A Letter to God' — plot and moral",
        "Summarize the poem 'Dust of Snow' and its meaning",
        "Summarize 'The Hack Driver' — plot and lesson",
        "Summarize 'Bholi' — character arc and message",
        "Summarize 'A Triumph of Surgery' from Footprints without Feet",
        "Summarize 'The Making of a Scientist' from Footprints without Feet",
    ],
};

const G10_HINDI: SubjectPromptBank = {
    "Explain a topic": [
        "Explain the theme of 'Surdas ke Pad' and the devotion expressed",
        "What is the main idea of 'Ram Lakshman Parshuram Samvad'?",
        "Explain the social message in 'Balgobin Bhagat'",
        "What values does 'Ek Kahani Yeh Bhi' by Mannu Bhandari convey?",
        "Explain the importance of language and culture in 'Maayi ke Anchal'",
        "What is the central theme of 'Atmakatha' in Kshitij?",
    ],
    "Make notes": [
        "Notes on the poems in Kshitij — themes and key verses",
        "Notes on the prose chapters in Kshitij — plot and themes",
        "Notes on Kritika — all chapters summarised",
        "Key grammatical concepts from the Hindi grammar syllabus",
        "Notes on writing skills — letter writing and essay topics",
        "Notes on 'Balgobin Bhagat' — character and social significance",
    ],
    "Generate a quiz": [
        "Quiz me on the poems in Kshitij — 10 questions",
        "Test my knowledge of the prose in Kshitij",
        "Quiz on Kritika chapters",
        "Hindi grammar quiz — kaarak, sandhi, and alankar",
        "Quiz on 'Balgobin Bhagat' and 'Netaji ka Chashma'",
        "Quiz on Hindi letter writing formats and topics",
    ],
    "Summarize a chapter": [
        "Summarize 'Surdas ke Pad' from Kshitij",
        "Summarize 'Balgobin Bhagat' — main events and message",
        "Summarize 'Netaji ka Chashma' — plot and patriotism",
        "Summarize 'Maayi ke Anchal' from Kritika",
        "Summarize 'Ek Kahani Yeh Bhi' by Mannu Bhandari",
        "Summarize the grammatical rules on sandhi and samaas",
    ],
};

// ─── Grade 11 ────────────────────────────────────────────────────────────────

const G11_PHYSICS: SubjectPromptBank = {
    "Explain a topic": [
        "Explain dimensional analysis and how to verify consistency of equations",
        "How does projectile motion work — derive the range and height equations",
        "What is the work-energy theorem? Explain with a variable force example",
        "Explain torque and angular momentum in rotational motion",
        "How does Newton's law of gravitation explain satellite orbits?",
        "Explain simple harmonic motion — conditions, equations, and energy",
    ],
    "Make notes": [
        "Notes on Units and Measurements — dimensions, errors, and significant figures",
        "Notes on Laws of Motion — Newton's three laws, friction, and equilibrium",
        "Notes on Work, Energy and Power — theorems and types of collisions",
        "Notes on System of Particles and Rotational Motion — moment of inertia",
        "Notes on Gravitation — Kepler's laws, orbital speed, and escape velocity",
        "Notes on Thermodynamics — laws, heat engines, and Carnot cycle",
    ],
    "Generate a quiz": [
        "Quiz me on Units, Dimensions, and Significant Figures",
        "Test me on Projectile Motion and Uniform Circular Motion",
        "Quiz on Laws of Motion — friction, Newton's laws, and equilibrium",
        "Quiz on Gravitation — Kepler's laws and escape velocity",
        "Quiz on Work, Energy and Power — problems on collisions",
        "Quiz on Oscillations — SHM equations and energy",
    ],
    "Summarize a chapter": [
        "Summarize Motion in a Plane — vectors, projectile, and circular motion",
        "Summarize Work, Energy and Power with key results",
        "Summarize System of Particles and Rotational Motion",
        "Summarize Gravitation — laws, satellites, and escape velocity",
        "Summarize Thermodynamics — laws and spontaneity",
        "Summarize Oscillations — conditions, energy, and damping",
    ],
};

const G11_CHEMISTRY: SubjectPromptBank = {
    "Explain a topic": [
        "Explain the mole concept and how to use it in stoichiometry",
        "How do electrons fill orbitals? Explain Aufbau, Pauli, and Hund's rules",
        "What is chemical bonding? Compare ionic, covalent, and metallic bonds",
        "Explain Le Chatelier's principle with examples from chemical equilibrium",
        "How does the periodic table reflect trends in atomic radius and ionisation energy?",
        "Explain hybridisation — sp, sp², and sp³ with examples",
    ],
    "Make notes": [
        "Notes on Some Basic Concepts of Chemistry — mole, molarity, and stoichiometry",
        "Notes on Structure of Atom — Bohr's model, quantum numbers, and electronic configuration",
        "Notes on Chemical Bonding — VSEPR theory and hybridisation",
        "Notes on Chemical Thermodynamics — enthalpy, entropy, and Gibbs energy",
        "Notes on Equilibrium — Kp, Kc, Le Chatelier's principle, and ionic equilibrium",
        "Notes on Hydrocarbons — alkanes, alkenes, alkynes, and arenes",
    ],
    "Generate a quiz": [
        "Quiz me on the Mole Concept and Stoichiometry",
        "Test me on Structure of Atom — quantum numbers and electronic configuration",
        "Quiz on Chemical Bonding and Molecular Structure",
        "Quiz on Periodic Table — trends in properties",
        "Quiz on Equilibrium — Le Chatelier's principle and Kp/Kc",
        "Quiz on Hydrocarbons — nomenclature and reactions",
    ],
    "Summarize a chapter": [
        "Summarize Some Basic Concepts of Chemistry — mole concept",
        "Summarize Structure of Atom — Bohr's model and orbitals",
        "Summarize Classification of Elements and Periodicity in Properties",
        "Summarize Chemical Bonding and Molecular Structure",
        "Summarize Thermodynamics — laws, enthalpy, and Gibbs energy",
        "Summarize Equilibrium — ionic equilibrium and buffer solutions",
    ],
};

const G11_MATH: SubjectPromptBank = {
    "Explain a topic": [
        "Explain trigonometric identities for sum and difference of angles",
        "How do permutations differ from combinations — explain with examples",
        "What is the binomial theorem? Explain how to find the general term",
        "Explain the concept of limits and how to evaluate them",
        "How do complex numbers work? Explain the Argand plane and polar form",
        "Explain conic sections — how ellipse, parabola, and hyperbola are formed",
    ],
    "Make notes": [
        "Notes on Trigonometric Functions — graphs, identities, and domain/range",
        "Key formulas for Sequences and Series — AP, GP, and their sums",
        "Notes on Straight Lines — all standard forms of the equation of a line",
        "Notes on Complex Numbers — modulus, polar form, and De Moivre's theorem",
        "Notes on Permutations and Combinations — formulas and applications",
        "Notes on Limits and Derivatives — standard limits and differentiation rules",
    ],
    "Generate a quiz": [
        "Quiz on Sets, Relations, and Functions — 10 questions",
        "Test me on Trigonometric Functions and identities",
        "Quiz on Permutations and Combinations — problems",
        "Quiz on Sequences and Series — AP and GP",
        "Quiz on Straight Lines and Conic Sections",
        "Quiz on Limits and Derivatives",
    ],
    "Summarize a chapter": [
        "Summarize Trigonometric Functions — key identities and graphs",
        "Summarize Sequences and Series — AP, GP formulas",
        "Summarize Complex Numbers and Quadratic Equations",
        "Summarize Straight Lines — all standard forms",
        "Summarize Conic Sections — circle, ellipse, parabola, hyperbola",
        "Summarize Limits and Derivatives — key results",
    ],
};

const G11_BIOLOGY: SubjectPromptBank = {
    "Explain a topic": [
        "Explain the five-kingdom classification — basis and key features of each kingdom",
        "How does photosynthesis work — explain the light and dark reactions",
        "What is cell division? Compare mitosis and meiosis",
        "Explain the structure and function of DNA and RNA",
        "How does the human digestive system work, step by step?",
        "Explain the mechanism of breathing and gas exchange in the lungs",
    ],
    "Make notes": [
        "Notes on Biological Classification — five kingdoms and their features",
        "Notes on Cell — structure, organelles, and their functions",
        "Notes on Photosynthesis in Higher Plants — light and Calvin cycle",
        "Notes on Respiration in Plants — aerobic and anaerobic pathways",
        "Notes on Human Physiology — digestion, circulation, and excretion",
        "Notes on Cell Cycle and Cell Division — mitosis vs meiosis",
    ],
    "Generate a quiz": [
        "Quiz me on Biological Classification — five kingdoms",
        "Test my knowledge of Cell Structure and Organelles",
        "Quiz on Photosynthesis — reactions, factors, and products",
        "Quiz on the Plant Kingdom — algae, bryophytes, and pteridophytes",
        "Quiz on Human Physiology — digestion and blood circulation",
        "Quiz on Cell Cycle — mitosis and meiosis stages",
    ],
    "Summarize a chapter": [
        "Summarize Biological Classification — kingdoms and features",
        "Summarize Cell: The Unit of Life — structure and organelles",
        "Summarize Photosynthesis in Higher Plants",
        "Summarize Breathing and Exchange of Gases",
        "Summarize Body Fluids and Circulation — blood, lymph, and heart",
        "Summarize Cell Cycle and Cell Division — key stages",
    ],
};

const G11_ECONOMICS: SubjectPromptBank = {
    "Explain a topic": [
        "Explain the difference between primary and secondary data with examples",
        "What is a frequency distribution? How do you construct one?",
        "Explain measures of central tendency — mean, median, and mode",
        "What is correlation? Explain positive, negative, and zero correlation",
        "How do you interpret data presented in bar charts and histograms?",
        "Explain the steps involved in data collection for an economic survey",
    ],
    "Make notes": [
        "Notes on Collection of Data — primary vs secondary, methods and sources",
        "Notes on Organisation of Data — classification and frequency distribution",
        "Notes on Presentation of Data — tables, bar charts, and histograms",
        "Notes on Measures of Central Tendency — mean, median, mode formulas",
        "Notes on Correlation — types and Karl Pearson's coefficient",
        "Key concepts from Introduction — what is economics and why statistics?",
    ],
    "Generate a quiz": [
        "Quiz me on Types and Methods of Data Collection",
        "Test my knowledge of Measures of Central Tendency",
        "Quiz on Presentation of Data — diagrams and graphs",
        "Quiz on Frequency Distribution — construction and interpretation",
        "Quiz on Correlation — coefficient and scatter diagrams",
        "Quiz on Organisation of Data — classification and tabulation",
    ],
    "Summarize a chapter": [
        "Summarize Collection of Data — key methods and sources",
        "Summarize Organisation of Data — frequency tables",
        "Summarize Presentation of Data — charts and graphs",
        "Summarize Measures of Central Tendency — formulas and uses",
        "Summarize Correlation — types and measurement",
        "Summarize the introductory chapter on Statistics for Economics",
    ],
};

const G11_ACCOUNTANCY: SubjectPromptBank = {
    "Explain a topic": [
        "Explain the double-entry system of accounting with examples",
        "What is a Bank Reconciliation Statement and why is it prepared?",
        "Explain the accounting equation — assets, liabilities, and capital",
        "What is depreciation? Explain the straight-line and reducing balance methods",
        "How do you prepare a Trial Balance — steps and purpose?",
        "What are financial statements? Explain the Trading and P&L Account",
    ],
    "Make notes": [
        "Notes on Introduction to Accounting — concepts, conventions, and basis",
        "Notes on Recording of Transactions — journal, ledger, and rules of debit/credit",
        "Notes on Bank Reconciliation Statement — causes of difference and format",
        "Notes on Depreciation — methods, journal entries, and their effect",
        "Notes on Trial Balance and Rectification of Errors — types and correction",
        "Notes on Financial Statements — Trading Account, P&L, and Balance Sheet",
    ],
    "Generate a quiz": [
        "Quiz me on Introduction to Accounting — concepts and conventions",
        "Test my knowledge of Journal Entries and Ledger Posting",
        "Quiz on Bank Reconciliation Statement — 10 questions",
        "Quiz on Depreciation — methods and calculations",
        "Quiz on Trial Balance — errors and their correction",
        "Quiz on Financial Statements — Trading, P&L, and Balance Sheet",
    ],
    "Summarize a chapter": [
        "Summarize Introduction to Accounting — key concepts",
        "Summarize Recording of Transactions — journal and ledger",
        "Summarize Bank Reconciliation Statement",
        "Summarize Depreciation, Provisions and Reserves",
        "Summarize Trial Balance and Rectification of Errors",
        "Summarize Financial Statements — format and key items",
    ],
};

const G11_BUSINESS_STUDIES: SubjectPromptBank = {
    "Explain a topic": [
        "Explain the difference between business, trade, and commerce",
        "What are the features of a sole proprietorship? When is it suitable?",
        "How does a Joint Stock Company differ from a partnership firm?",
        "Explain the different types of business services — banking, insurance, and transport",
        "What is e-commerce? Explain its types and advantages",
        "Explain social responsibility of business — internal and external stakeholders",
    ],
    "Make notes": [
        "Notes on Business, Trade and Commerce — meaning and distinctions",
        "Notes on Forms of Business Organisation — sole proprietor, partnership, company",
        "Notes on Private, Public and Global Enterprises — features and comparison",
        "Notes on Business Services — banking, insurance, warehousing, and transport",
        "Notes on Emerging Modes of Business — e-commerce and outsourcing",
        "Notes on Social Responsibilities of Business and Business Ethics",
    ],
    "Generate a quiz": [
        "Quiz me on Forms of Business Organisation — 10 questions",
        "Test my knowledge of Business, Trade and Commerce",
        "Quiz on Private, Public and Global Enterprises",
        "Quiz on Business Services — banking and insurance",
        "Quiz on Emerging Modes of Business — e-commerce",
        "Quiz on Social Responsibilities of Business",
    ],
    "Summarize a chapter": [
        "Summarize Business, Trade and Commerce — key concepts",
        "Summarize Forms of Business Organisation — all types",
        "Summarize Private, Public and Global Enterprises",
        "Summarize Business Services — types and importance",
        "Summarize Emerging Modes of Business",
        "Summarize Social Responsibilities of Business and Ethics",
    ],
};

// ─── Master maps ─────────────────────────────────────────────────────────────

const GRADE_10_PROMPTS: Record<string, SubjectPromptBank> = {
    science: G10_SCIENCE,
    math: G10_MATH,
    social: G10_SOCIAL,
    social_history: G10_SOCIAL,
    social_geography: G10_SOCIAL,
    social_civics: G10_SOCIAL,
    social_economics: G10_SOCIAL,
    english: G10_ENGLISH,
    hindi: G10_HINDI,
};

const GRADE_11_PROMPTS: Record<string, SubjectPromptBank> = {
    physics: G11_PHYSICS,
    chemistry: G11_CHEMISTRY,
    math: G11_MATH,
    biology: G11_BIOLOGY,
    economics: G11_ECONOMICS,
    accountancy: G11_ACCOUNTANCY,
    business_studies: G11_BUSINESS_STUDIES,
    english: G10_ENGLISH,  // reuse G10 English bank (same books)
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns 6 randomly sampled prompts for a given task, drawn from the pool
 * of prompts across the user's active subjects.
 *
 * If the combined pool has fewer than 6 unique prompts (single-subject edge
 * case with 6 available), the full 6 are returned in shuffled order.
 */
export function getQuickPromptsForTask(
    grade: number,
    task: TaskKey,
    userSubjectIds: string[],
): string[] {
    const map = grade === 11 ? GRADE_11_PROMPTS : GRADE_10_PROMPTS;

    // Collect prompts from all user subjects, deduplicating social_* siblings
    const seen = new Set<string>();
    const pool: string[] = [];

    for (const id of userSubjectIds) {
        const bank = map[id];
        if (!bank) continue;
        const prompts = bank[task];
        if (!prompts) continue;
        for (const p of prompts) {
            if (!seen.has(p)) {
                seen.add(p);
                pool.push(p);
            }
        }
    }

    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        // eslint-disable-next-line no-param-reassign
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return pool.slice(0, 6);
}
