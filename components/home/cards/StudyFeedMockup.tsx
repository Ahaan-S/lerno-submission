import React from "react";
import { Lightbulb } from "lucide-react";

interface StudyFeedMockupProps {
    animationStage?: number; // 0 = hidden, 1 = question visible (no selection), 2 = answer selected
}

const StudyFeedMockup = ({ animationStage = 2 }: StudyFeedMockupProps) => {
    const isVisible = animationStage >= 1;
    const isAnswerSelected = animationStage >= 2;

    return (
        <div
            style={{
                width: '480px',
                backgroundColor: '#F8FAFC',
                borderRadius: '24px',
                boxShadow: `
                    0 0 0 14px rgba(248, 250, 252, 0.5),
                    0 25px 50px rgba(0, 0, 0, 0.15),
                    0 4px 8px rgba(0, 0, 0, 0.08)
                `,
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                fontFamily: 'var(--font-inter)',
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translate(0, 0)' : 'translate(30px, 30px)',
                transition: 'opacity 600ms ease-out, transform 700ms ease-out',
            }}
        >
            {/* Header / Meta info */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>
                        Science · How do Organisms Reproduce?
                    </span>
                    <span style={{
                        fontSize: '9px',
                        color: 'var(--green-200)',
                        backgroundColor: 'var(--green-10)',
                        padding: '2px 6px',
                        borderRadius: '8px',
                        fontWeight: 600
                    }}>
                        Easy
                    </span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1E293B', lineHeight: '1.4', textAlign: 'center' }}>
                    Method of reproduction in plasmodium is
                </h3>
            </div>

            {/* Options Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {/* Option 1 - Animates to selected */}
                <div style={{
                    backgroundColor: isAnswerSelected ? '#3B82F6' : 'white',
                    borderRadius: '12px',
                    padding: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: isAnswerSelected ? '0 4px 6px -1px rgba(116, 156, 255, 0.2)' : 'none',
                    textAlign: 'center',
                    border: isAnswerSelected ? 'none' : '1px solid #E2E8F0',
                    transition: 'background-color 400ms ease-out, box-shadow 400ms ease-out, border 400ms ease-out',
                }}>
                    <span style={{
                        fontSize: '16px',
                        fontWeight: 500,
                        color: isAnswerSelected ? 'white' : '#475569',
                        transition: 'color 400ms ease-out',
                    }}>Multiple Fission</span>
                </div>

                {/* Option 2 */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #E2E8F0',
                    textAlign: 'center',
                }}>
                    <span style={{ fontSize: '16px', fontWeight: 500, color: '#475569' }}>Binary Fission</span>
                </div>

                {/* Option 3 */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #E2E8F0',
                    textAlign: 'center',
                }}>
                    <span style={{ fontSize: '16px', fontWeight: 500, color: '#475569' }}>Budding</span>
                </div>

                {/* Option 4 */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #E2E8F0',
                    textAlign: 'center',
                }}>
                    <span style={{ fontSize: '16px', fontWeight: 500, color: '#475569' }}>Spore Formation</span>
                </div>
            </div>

            {/* Footer Actions */}
            <div style={{ display: 'flex', gap: '10px' }}>
                <button style={{
                    flex: 1,
                    backgroundColor: '#3B82F6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                }}>
                    Submit
                </button>
                <button style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: '#F1F5F9',
                    color: '#749CFF',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '10px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                }}>
                    <Lightbulb size={16} strokeWidth={2.5} />
                    Hint
                </button>
            </div>
        </div>
    );
};

export default StudyFeedMockup;
