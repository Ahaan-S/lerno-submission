import React from "react";
import { Clock, Check } from "lucide-react";

interface StudyMaterialMockupProps {
    isVisible?: boolean;
}

// Chapter item component
const ChapterItem = ({
    number,
    title,
    duration,
    status,
    progress
}: {
    number: number;
    title: string;
    duration: string;
    status?: 'complete' | 'in-progress' | 'not-started';
    progress: number;
}) => {
    const isComplete = status === 'complete';
    const progressColor = isComplete ? '#10B981' : '#3B82F6';

    return (
        <div style={{ padding: '12px 14px', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                <span style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: '#F1F5F9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#64748B'
                }}>
                    {number}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#1E293B', flex: 1 }}>{title}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px', fontSize: '10px', color: '#64748B' }}>
                <Clock size={12} />
                <span>{duration}</span>
                {isComplete && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10B981' }}>
                        <Check size={12} />
                        Complete
                    </span>
                )}
                {status === 'in-progress' && (
                    <span style={{ color: '#3B82F6' }}>{progress}% done</span>
                )}
            </div>
            <div style={{ height: '3px', backgroundColor: '#E2E8F0', borderRadius: '2px' }}>
                <div style={{ height: '100%', width: `${progress}%`, backgroundColor: progressColor, borderRadius: '2px' }} />
            </div>
        </div>
    );
};

// Subject card component
const SubjectCard = ({
    subject,
    chapters,
    isVisible,
    delay,
}: {
    subject: string;
    chapters: Array<{ title: string; duration: string; status?: 'complete' | 'in-progress' | 'not-started'; progress: number }>;
    isVisible: boolean;
    delay: number;
}) => (
    <div
        style={{
            flex: 1,
            height: '560px',
            backgroundColor: 'white',
            borderRadius: '18px',
            padding: '20px',
            border: '1px solid #E2E8F0',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            overflow: 'hidden',
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
            transition: `opacity 500ms ease-out ${delay}ms, transform 500ms ease-out ${delay}ms`,
        }}
    >
        {/* Header - two rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Row 1: Class 9 | Chapters */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#64748B' }}>Class 10</span>
                <span style={{ fontSize: '11px', color: '#64748B' }}>Chapters</span>
            </div>
            {/* Row 2: Subject | Number */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '20px', fontWeight: 500, color: '#1E293B' }}>{subject}</span>
                <span style={{ fontSize: '18px', fontWeight: 500, color: '#1E293B' }}>{chapters.length}</span>
            </div>
        </div>

        {/* Chapters */}
        {chapters.map((chapter, index) => (
            <ChapterItem
                key={index}
                number={index + 1}
                title={chapter.title}
                duration={chapter.duration}
                status={chapter.status}
                progress={chapter.progress}
            />
        ))}
    </div>
);

const StudyMaterialMockup = ({ isVisible = true }: StudyMaterialMockupProps) => {
    const scienceChapters = [
        { title: 'Chemical Reactions and...', duration: '2h 15m', status: 'complete' as const, progress: 100 },
        { title: 'Acids, Bases and Salts', duration: '1h 45m', status: 'complete' as const, progress: 100 },
        { title: 'Metals and Non-metals', duration: '2h 30m', status: 'in-progress' as const, progress: 60 },
        { title: 'Carbon and its Compounds', duration: '2h 30m', status: 'in-progress' as const, progress: 60 },
        { title: 'Life Processes', duration: '2h 30m', status: 'in-progress' as const, progress: 60 },
        { title: 'Control and Coordination', duration: '2h 30m', status: 'in-progress' as const, progress: 60 },
        { title: 'How do Organisms Reproduce?', duration: '2h 30m', status: 'in-progress' as const, progress: 60 },
        { title: 'Heredity and Evolution', duration: '2h 30m', status: 'in-progress' as const, progress: 60 },
        { title: 'Light-Reflection and Refraction', duration: '2h 30m', status: 'in-progress' as const, progress: 60 },
        { title: 'The Human Eye and the Colourful World', duration: '2h 30m', status: 'in-progress' as const, progress: 60 },
        { title: 'Electricity', duration: '2h 30m', status: 'in-progress' as const, progress: 60 },
        { title: 'Magnetic Effects of Electric Current', duration: '2h 30m', status: 'in-progress' as const, progress: 60 },
        { title: 'Our Environment', duration: '2h 30m', status: 'in-progress' as const, progress: 60 },
    ];

    const mathChapters = [
        { title: 'Real Numbers', duration: '3h 00m', status: 'complete' as const, progress: 100 },
        { title: 'Polynomials', duration: '2h 45m', status: 'in-progress' as const, progress: 45 },
        { title: 'Linear Equations in Two Variables', duration: '2h 15m', status: 'not-started' as const, progress: 0 },
        { title: 'Triangles', duration: '2h 15m', status: 'not-started' as const, progress: 0 },
        { title: 'Circles', duration: '2h 15m', status: 'not-started' as const, progress: 0 },
        { title: 'Quadratic Equations', duration: '2h 15m', status: 'not-started' as const, progress: 0 },
        { title: 'Trigonometry', duration: '2h 15m', status: 'not-started' as const, progress: 0 },
        { title: 'Trigonometric Height and Distance', duration: '2h 15m', status: 'not-started' as const, progress: 0 },
        { title: 'Arithmetic Progression', duration: '2h 15m', status: 'not-started' as const, progress: 0 },
        { title: 'Areas Related to Circles', duration: '2h 15m', status: 'not-started' as const, progress: 0 },
        { title: 'Surface Areas and Volumes', duration: '2h 15m', status: 'not-started' as const, progress: 0 },
        { title: 'Statistics', duration: '2h 15m', status: 'not-started' as const, progress: 0 },
        { title: 'Probability', duration: '2h 15m', status: 'not-started' as const, progress: 0 },
    ];

    const historyChapters = [
        { title: 'The Rise of Nationalism in...', duration: '2h 30m', status: 'complete' as const, progress: 100 },
        { title: 'Nationalism in India', duration: '2h 00m', status: 'in-progress' as const, progress: 75 },
        { title: 'The Making of a Global World', duration: '2h 20m', status: 'not-started' as const, progress: 0 },
        { title: 'The Age of Industrialisation', duration: '2h 20m', status: 'not-started' as const, progress: 0 },
        { title: 'Print Culture and the Modern World', duration: '2h 20m', status: 'not-started' as const, progress: 0 },
    ];

    return (
        <div
            style={{
                display: 'flex',
                gap: '24px',
                padding: '24px',
                backgroundColor: '#F8FAFC',
                borderRadius: '24px',
                width: '100%',
                boxShadow: `
                    0 0 0 1px rgba(0, 0, 0, 0.03),
                    0 8px 24px rgba(0, 0, 0, 0.08),
                    0 2px 6px rgba(0, 0, 0, 0.04)
                `,
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(40px)',
                transition: 'opacity 600ms ease-out, transform 700ms ease-out',
            }}
        >
            <SubjectCard subject="Science" chapters={scienceChapters} isVisible={isVisible} delay={0} />
            <SubjectCard subject="Mathematics" chapters={mathChapters} isVisible={isVisible} delay={100} />
            <SubjectCard subject="History" chapters={historyChapters} isVisible={isVisible} delay={200} />
        </div>
    );
};

export default StudyMaterialMockup;
