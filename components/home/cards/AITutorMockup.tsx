import React from "react";
import { Maximize2, X, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

interface AITutorMockupProps {
    isVisible?: boolean;
}

const AITutorMockup = ({ isVisible = true }: AITutorMockupProps) => {
    return (
        <div
            style={{
                width: '450px',
                backgroundColor: 'var(--base-100)',
                borderRadius: '20px',
                boxShadow: `
                    0 0 0 14px rgba(248, 250, 252, 0.5),
                    0 25px 50px rgba(0, 0, 0, 0.15),
                    0 4px 8px rgba(0, 0, 0, 0.08)
                `,
                paddingBottom: '48px',
                paddingTop: '18px',
                paddingLeft: '48px',
                paddingRight: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                fontFamily: 'var(--font-inter)',
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translate(0, 0)' : 'translate(-30px, 30px)',
                transition: 'opacity 600ms ease-out, transform 700ms ease-out',
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#1E293B' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 500, margin: 0 }}>Photosynthesis</h3>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B' }}>
                        <ChevronLeft size={14} />
                        <span style={{ fontSize: '12px', fontWeight: 500 }}>1/2</span>
                        <ChevronRight size={14} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748B' }}>
                        <Maximize2 size={14} />
                        <X size={15} />
                    </div>
                </div>
            </div>

            {/* Content Card */}
            <div style={{
                backgroundColor: 'white',
                border: '1px solid #E2E8F0',
                borderRadius: '14px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
            }}>
                {/* Source Header */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: '#3B82F6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '14px',
                    }}>
                        BI
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>NCERT - Biology</span>
                        <span style={{ fontSize: '15px', color: '#1E293B', fontWeight: 600 }}>Life Processes</span>
                    </div>
                </div>

                {/* Text Content */}
                <p style={{
                    fontSize: '12px',
                    lineHeight: '1.6',
                    color: '#475569',
                    margin: 0,
                }}>
                    Carbon and energy requirements of the autotrophic organism are fulfilled by photosynthesis. It is the process by which autotrophs take in substances from the outside and convert them into stored forms of energy.
                </p>

                {/* Equation */}
                <div style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#334155',
                    padding: '6px 0',
                    borderBottom: '1px solid #F1F5F9',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                }}>
                    <span>6CO₂ + 12H₂O</span>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '10px', color: '#64748B' }}>
                        <span style={{ fontSize: '16px', color: '#334155' }}>→</span>
                    </div>
                    <span>C₆H₁₂O₆ + 6O₂ + 6H₂O</span>
                </div>

                {/* Meta Footer */}
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    fontSize: '10px',
                    color: '#64748B',
                    alignItems: 'center',
                }}>
                    <span>Subject: <strong style={{ color: '#334155' }}>Biology</strong></span>
                    <span style={{ width: '1px', height: '10px', backgroundColor: '#CBD5E1' }}></span>
                    <span>Chapter: <strong style={{ color: '#334155' }}>Life Processes</strong></span>
                    <span style={{ width: '1px', height: '10px', backgroundColor: '#CBD5E1' }}></span>
                    <span>Page: <strong style={{ color: '#334155' }}>81</strong></span>
                </div>
            </div>

            {/* Bottom Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: '#64748B' }}>Verified from NCERT</span>

                <button style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#3B82F6',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer',
                    padding: 0,
                }}>
                    View full document
                    <ArrowRight size={14} />
                </button>
            </div>
        </div>
    );
};

export default AITutorMockup;
