export type Section = { title?: string; items: string[] };

/** Grade 10 chapter data - also used for dashboard quick resources */
export const CHAPTER_DATA_10: Record<string, Section[]> = {
    science: [{
        items: [
            "Chemical Reactions and Equations",
            "Acids, Bases and Salts",
            "Metals and Non-metals",
            "Carbon and its Compounds",
            "Life Processes",
            "Control and Coordination",
            "How do Organisms Reproduce?",
            "Heredity",
            "Light – Reflection and Refraction",
            "The Human Eye and the Colourful World",
            "Electricity",
            "Magnetic Effects of Electric Current",
            "Our Environment"
        ]
    }],
    math: [{
        items: [
            "Real Numbers", "Polynomials", "Pair of Linear Equations in Two Variables",
            "Quadratic Equations", "Arithmetic Progressions", "Triangles", "Coordinate Geometry",
            "Introduction to Trigonometry", "Some Applications of Trigonometry", "Circles",
            "Areas Related to Circles", "Surface Areas and Volumes", "Statistics", "Probability"
        ]
    }],
    english: [{
        items: [
            "Prose - First Flight",
            "Prose - Footprints without feet",
            "Poems",
            "Grammar",
            "Writing",
            "Reading Comprehension"
        ]
    }],
    hindi: [{
        items: ["Prose", "Poetry", "Grammar"]
    }],
    social: [
        {
            title: "History (India and the Contemporary World – II)",
            items: [
                "Nationalism in India",
                "The Making of a Global World",
                "The Age of Industrialisation",
                "Print Culture and the Modern World"
            ]
        },
        {
            title: "Geography (Contemporary India – II)",
            items: [
                "Resources and Development",
                "Forest and Wildlife Resources",
                "Water Resources",
                "Agriculture",
                "Minerals and Energy Resources",
                "Manufacturing Industries"
            ]
        },
        {
            title: "Political Science (Democratic Politics – II)",
            items: [
                "Power Sharing",
                "Federalism",
                "Gender, Religion and Caste",
                "Political Parties",
                "Outcomes of Democracy"
            ]
        },
        {
            title: "Economics (Understanding Economic Development)",
            items: [
                "Development",
                "Sectors of the Indian Economy",
                "Money and Credit",
                "Globalisation and the Indian Economy"
            ]
        }
    ],
    french: [{
        items: [
            "Retrouvons nos amis",
            "Après le bac",
            "Chercher du travail",
            "Le plaisir de lire",
            "Les médias",
            "Chacun ses goûts",
            "En pleine forme",
            "L'environnement",
            "Vive la République!"
        ]
    }]
};

/** Grade 9 chapter data */
export const CHAPTER_DATA_9: Record<string, Section[]> = {
    math: [{
        items: [
            "Number Systems",
            "Polynomials",
            "Coordinate Geometry",
            "Linear Equations in Two Variables",
            "Introduction to Euclid's Geometry",
            "Lines and Angles",
            "Triangles",
            "Quadrilaterals",
            "Circles",
            "Heron's Formula",
            "Surface Areas and Volumes",
            "Statistics"
        ]
    }],
    science: [{
        items: [
            "Matter in Our Surroundings",
            "Is Matter Around Us Pure?",
            "Atoms and Molecules",
            "Structure of the Atom",
            "The Fundamental Unit of Life",
            "Tissues",
            "Motion",
            "Force and Laws of Motion",
            "Gravitation",
            "Work and Energy",
            "Sound",
            "Improvement in Food Resources"
        ]
    }],
    social: [
        {
            title: "History: India and the Contemporary World – I",
            items: [
                "The French Revolution",
                "Socialism in Europe and the Russian Revolution",
                "Nazism and the Rise of Hitler",
                "Forest Society and Colonialism",
                "Pastoralists in the Modern World"
            ]
        },
        {
            title: "Geography: Contemporary India – I",
            items: [
                "India – Size and Location",
                "Physical Features of India",
                "Drainage",
                "Climate",
                "Natural Vegetation and Wildlife",
                "Population"
            ]
        },
        {
            title: "Political Science: Democratic Politics – I",
            items: [
                "What is Democracy? Why Democracy?",
                "Constitutional Design",
                "Electoral Politics",
                "Working of Institutions",
                "Democratic Rights"
            ]
        },
        {
            title: "Economics",
            items: [
                "The Story of Village Palampur",
                "People as Resource",
                "Poverty as a Challenge",
                "Food Security in India"
            ]
        }
    ],
    english: [{
        items: [
            "Prose - Beehive",
            "Prose - Moments",
            "Poems",
            "Grammar",
            "Reading Comprehension"
        ]
    }],
    french: [{
        items: [
            "La famille",
            "Au lycée",
            "Une journée de Pauline",
            "Les saisons",
            "Les voyages",
            "Les loisirs et les sports",
            "L'argent de poche",
            "Faire des achats",
            "Un dîner en famille",
            "La mode",
            "Les fêtes",
            "La francophonie"
        ]
    }],
    hindi: CHAPTER_DATA_10.hindi
};

/** Grade 11 chapter data */
export const CHAPTER_DATA_11: Record<string, Section[]> = {
    physics: [{
        items: [
            "Units and Measurements",
            "Motion in a Straight Line",
            "Motion in a Plane",
            "Laws of Motion",
            "Work, Energy and Power",
            "System of Particles and Rotational Motion",
            "Gravitation",
            "Mechanical Properties of Solids",
            "Mechanical Properties of Fluids",
            "Thermal Properties of Matter",
            "Thermodynamics",
            "Behaviour of Perfect Gases and Kinetic Theory",
            "Oscillations",
            "Waves"
        ]
    }],
    chemistry: [
        {
            items: [
                "Some Basic Concepts of Chemistry",
                "Structure of Atom",
                "Classification of Elements and Periodicity in Properties",
                "Chemical Bonding and Molecular Structure",
                "Chemical Thermodynamics",
                "Equilibrium",
                "Redox Reactions",
                "Organic Chemistry: Some Basic Principles and Techniques",
                "Hydrocarbons"
            ]
        }
    ],
    math: [{
        items: [
            "Sets",
            "Relations and Functions",
            "Trigonometric Functions",
            "Complex Numbers and Quadratic Equations",
            "Linear Inequalities",
            "Permutations and Combinations",
            "Binomial Theorem",
            "Sequences and Series",
            "Straight Lines",
            "Conic Sections",
            "Introduction to Three-dimensional Geometry",
            "Limits and Derivatives",
            "Statistics",
            "Probability"
        ]
    }],
    economics: [
        {
            title: "Part A: Statistics for Economics",
            items: [
                "Introduction",
                "Collection of Data",
                "Organisation of Data",
                "Presentation of Data",
                "Measures of Central Tendency",
                "Correlation"
            ]
        }
    ],
    accountancy: [
        {
            items: [
                "Introduction to Accounting",
                "Theory Base of Accounting",
                "Recording of Transactions — I",
                "Recording of Transactions — II",
                "Bank Reconciliation Statement",
                "Trial Balance and Rectification of Errors"
            ]
        }
    ],
    business_studies: [
        {
            items: [
                "Business, Trade and Commerce",
                "Forms of Business Organisation",
                "Private, Public and Global Enterprises",
                "Business Services",
                "Emerging Modes of Business",
                "Social Responsibilities of Business and Business Ethics"
            ]
        }
    ],
    english: [{
        items: [
            "Hornbill – Prose",
            "Hornbill – Poetry",
            "Snapshots",
            "Writing Skills",
            "Grammar",
            "Reading Comprehension"
        ]
    }],
    biology: [
        {
            title: "Unit I: Diversity of Living Organisms",
            items: [
                "The Living World",
                "Biological Classification",
                "Plant Kingdom",
                "Animal Kingdom"
            ]
        },
        {
            title: "Unit II: Structural Organisation in Plants and Animals",
            items: [
                "Morphology of Flowering Plants",
                "Anatomy of Flowering Plants",
                "Structural Organisation in Animals"
            ]
        },
        {
            title: "Unit III: Cell: Structure and Function",
            items: [
                "Cell: The Unit of Life",
                "Biomolecules",
                "Cell Cycle and Cell Division"
            ]
        },
        {
            title: "Unit IV: Plant Physiology",
            items: [
                "Photosynthesis in Higher Plants",
                "Respiration in Plants",
                "Plant Growth and Development"
            ]
        },
        {
            title: "Unit V: Human Physiology",
            items: [
                "Breathing and Exchange of Gases",
                "Body Fluids and Circulation",
                "Excretory Products and their Elimination",
                "Locomotion and Movement",
                "Neural Control and Coordination",
                "Chemical Coordination and Integration"
            ]
        }
    ],
    computer_science: [{
        items: [
            "Computer System",
            "Encoding Schemes and Number System",
            "Emerging Trends",
            "Introduction to Problem Solving",
            "Getting Started with Python",
            "Flow of Control",
            "Functions",
            "Strings",
            "Lists",
            "Tuples and Dictionaries",
            "Society, Law and Ethics"
        ]
    }]
};

/** Maps subject ids to display names */
export const SUBJECT_LABELS: Record<string, string> = {
    science: "Science",
    math: "Mathematics",
    english: "English",
    hindi: "Hindi",
    social: "Social Science",
    /** Ask mode: NCERT Social Science books (Qdrant subject + book) */
    social_history: "History",
    social_geography: "Geography",
    social_civics: "Political Science",
    social_economics: "Economics",
    french: "French",
    /** Grade 11 subjects */
    physics: "Physics",
    chemistry: "Chemistry",
    biology: "Biology",
    economics: "Economics",
    accountancy: "Accountancy",
    business_studies: "Business Studies",
    computer_science: "Computer Science"
};

export type SubjectOption = { id: string; label: string };

export const GRADE_10_SUBJECT_OPTIONS: SubjectOption[] = [
    { id: "science", label: SUBJECT_LABELS.science },
    { id: "math", label: SUBJECT_LABELS.math },
    { id: "english", label: SUBJECT_LABELS.english },
    { id: "hindi", label: SUBJECT_LABELS.hindi },
    { id: "social", label: SUBJECT_LABELS.social },
    { id: "french", label: SUBJECT_LABELS.french },
];

export const GRADE_11_SUBJECT_OPTIONS: SubjectOption[] = [
    { id: "physics", label: SUBJECT_LABELS.physics },
    { id: "chemistry", label: SUBJECT_LABELS.chemistry },
    { id: "math", label: SUBJECT_LABELS.math },
    { id: "biology", label: SUBJECT_LABELS.biology },
    { id: "economics", label: SUBJECT_LABELS.economics },
    { id: "accountancy", label: SUBJECT_LABELS.accountancy },
    { id: "business_studies", label: SUBJECT_LABELS.business_studies },
    { id: "english", label: SUBJECT_LABELS.english },
    { id: "computer_science", label: SUBJECT_LABELS.computer_science },
];

export function getSubjectOptionsForGrade(grade: number | string): SubjectOption[] {
    const normalized =
        typeof grade === "string" && grade.startsWith("Class ")
            ? Number(grade.replace("Class ", ""))
            : Number(grade);
    return normalized === 11 ? GRADE_11_SUBJECT_OPTIONS : GRADE_10_SUBJECT_OPTIONS;
}

export function getAiTutorSubjectOptionsForGrade(grade: number | string): SubjectOption[] {
    const normalized =
        typeof grade === "string" && grade.startsWith("Class ")
            ? Number(grade.replace("Class ", ""))
            : Number(grade);
    return normalized === 11
        ? [
              { id: "physics", label: SUBJECT_LABELS.physics },
              { id: "chemistry", label: SUBJECT_LABELS.chemistry },
              { id: "math", label: SUBJECT_LABELS.math },
              { id: "economics", label: SUBJECT_LABELS.economics },
              { id: "business_studies", label: SUBJECT_LABELS.business_studies },
              { id: "accountancy", label: SUBJECT_LABELS.accountancy },
          ]
        : [
              { id: "science", label: SUBJECT_LABELS.science },
              { id: "social", label: SUBJECT_LABELS.social },
              { id: "math", label: SUBJECT_LABELS.math },
          ];
}

/**
 * Intersects saved profile subjects with the current Learn/Ask tutor list for this grade.
 * When Class 11 profiles still have the old default (PCM + Economics only), appends
 * `business_studies` so new curriculum subjects appear without a DB migration.
 */
export function mergeProfileSubjectsForTutorSubjects(
    grade: number | string,
    profileSubjects: unknown
): string[] | null {
    const normalized =
        typeof grade === "string" && grade.startsWith("Class ")
            ? Number(grade.replace("Class ", ""))
            : Number(grade);
    const g = Number.isFinite(normalized) ? normalized : 10;

    const tutorIds = getAiTutorSubjectOptionsForGrade(g).map((s) => s.id);
    const allowed = new Set(tutorIds);
    if (!Array.isArray(profileSubjects) || profileSubjects.length === 0) {
        return null;
    }
    let cleaned = (profileSubjects as string[]).filter(
        (id) => typeof id === "string" && allowed.has(id)
    );
    if (cleaned.length === 0) return null;

    if (g === 11 && cleaned.length === 4) {
        const s = new Set(cleaned);
        const oldCore = ["physics", "chemistry", "math", "economics"] as const;
        if (oldCore.every((id) => s.has(id)) && !s.has("business_studies")) {
            cleaned = [...cleaned, "business_studies"];
        }
    }
    return cleaned;
}

export function getStudyFeedSubjectLabelsForGrade(grade: number | string): string[] {
    const normalized =
        typeof grade === "string" && grade.startsWith("Class ")
            ? Number(grade.replace("Class ", ""))
            : Number(grade);
    return normalized === 11
        ? [SUBJECT_LABELS.physics, SUBJECT_LABELS.chemistry, SUBJECT_LABELS.math]
        : [SUBJECT_LABELS.science, SUBJECT_LABELS.math];
}

export function getChapterLimitForSubject(
    grade: number | string,
    subjectSlugOrLabel: string
): number | null {
    const normalized =
        typeof grade === "string" && grade.startsWith("Class ")
            ? Number(grade.replace("Class ", ""))
            : Number(grade);
    if (normalized !== 11) return null;
    const key = (subjectSlugOrLabel ?? "").toLowerCase();
    if (key === "physics") return 7;
    if (key === "chemistry") return 6;
    if (key === "math" || key === "mathematics") return 9;
    if (key === "economics") return 6;
    if (key === "business_studies") return 6;
    if (key === "accountancy") return 6;
    return null;
}

/** Flatten all chapters from a grade's data into { title, subject } for quick resources */
export function flattenChaptersToResources(
    chapterData: Record<string, Section[]>
): { title: string; subject: string; subjectId: string }[] {
    const resources: { title: string; subject: string; subjectId: string }[] = [];
    for (const [subjectId, sections] of Object.entries(chapterData)) {
        const subjectLabel = SUBJECT_LABELS[subjectId] ?? subjectId;
        for (const section of sections) {
            for (const item of section.items) {
                resources.push({
                    title: item,
                    subject: subjectLabel,
                    subjectId,
                });
            }
        }
    }
    return resources;
}
