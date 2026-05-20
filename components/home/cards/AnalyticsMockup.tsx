import React from "react";

interface AnalyticsMockupProps {
    isVisible?: boolean;
}

const AnalyticsMockup = ({ isVisible = true }: AnalyticsMockupProps) => {
    // Weekly activity data (simplified)
    const days = [
        { day: 'M', value: 45 },
        { day: 'T', value: 35 },
        { day: 'W', value: 55 },
        { day: 'T', value: 48 },
        { day: 'F', value: 65 },
    ];

    const maxValue = Math.max(...days.map(d => d.value));

    return (
        <div
            style={{
                width: '450px',
                backgroundColor: 'var(--base-100)',
                borderRadius: '20px',
                boxShadow: `
                    0 0 0 14px rgba(248, 250, 252, 0.5),
                    0 25px 50px rgba(0, 0, 0, 0.15),
                    0 4px 8px rgba(0, 0, 0, 0.08),
                    0px 17.37px 19px -3.37px rgba(219, 234, 254, 0.5),
                    0px 22.42px 26.63px -12.53px rgba(219, 234, 254, 0.5)
                `,
                padding: '24px',
                paddingTop: '44px',
                paddingLeft: '44px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                fontFamily: 'var(--font-inter)',
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translate(0, 0)' : 'translate(-30px, -30px)',
                transition: 'opacity 600ms ease-out, transform 700ms ease-out',
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1E293B', margin: 0 }}>
                    Activity This Week
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'white',
                        backgroundColor: '#3B82F6',
                        padding: '4px 12px',
                        borderRadius: '20px',
                    }}>
                        Questions
                    </span>
                    <span style={{
                        fontSize: '11px',
                        fontWeight: 500,
                        color: '#64748B',
                        backgroundColor: '#F1F5F9',
                        padding: '4px 12px',
                        borderRadius: '20px',
                    }}>
                        Minutes
                    </span>
                </div>
            </div>

            {/* Bar Chart */}
            <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                height: '180px',
                gap: '16px',
                paddingTop: '20px',
            }}>
                {days.map((item, index) => {
                    const barHeight = Math.round((item.value / maxValue) * 150);
                    // Staggered delay for each bar
                    const delay = isVisible ? 400 + (index * 100) : 0;

                    return (
                        <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
                            <div style={{
                                width: '100%',
                                height: isVisible ? `${barHeight}px` : '0px',
                                background: 'linear-gradient(to bottom, #3B82F6, #AFD6FD)',
                                borderRadius: '5px 5px 0 0',
                                transition: `height 600ms ease-in-out ${delay}ms`,
                            }} />
                            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>{item.day}</span>
                        </div>
                    );
                })}
            </div>

            {/* Stats Footer */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: '12px',
                borderTop: '1px solid #F1F5F9',
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 700, color: '#1E293B' }}>248</span>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>Questions this week</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#10B981' }}>+18%</span>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>vs last week</span>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsMockup;
