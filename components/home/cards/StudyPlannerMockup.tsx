import React from "react";
import { Calendar, Clock, Sparkles, Check } from "lucide-react";

// Schedule item data with reduced opacity colors
const scheduleItems = [
    { time: "09:00 AM", subject: "Biology", topic: "Cell Structure", duration: "45 mins", color: "rgba(34, 197, 94, 0.6)", completed: true },
    { time: "11:30 AM", subject: "Mathematics", topic: "Practice Problems", duration: "20 mins", color: "rgba(59, 130, 246, 0.6)", completed: false },
    { time: "02:00 PM", subject: "Physics", topic: "Newton's Laws", duration: "30 mins", color: "rgba(168, 85, 247, 0.6)", completed: false },
    { time: "04:30 PM", subject: "Chemistry", topic: "Periodic Table Review", duration: "25 mins", color: "rgba(245, 158, 11, 0.6)", completed: false },
];

// Week days data
const weekDays = [
    { day: "Mon", date: 11, selected: false },
    { day: "Tue", date: 12, selected: false },
    { day: "Wed", date: 13, selected: false },
    { day: "Thu", date: 14, selected: true },
    { day: "Fri", date: 15, selected: false },
    { day: "Sat", date: 16, selected: false },
    { day: "Sun", date: 17, selected: false },
];

const StudyPlannerMockup = () => {
    return (
        <div
            style={{
                width: '260px',
                height: '290px',
                backgroundColor: '#F8FAFC',
                borderRadius: '16px',
                boxShadow: `
                    0 0 0 8px rgba(255, 255, 255, 0.4),
                    12px 20px 40px rgba(0, 0, 0, 0.16),
                    0px 2px 4px rgba(0, 0, 0, 0.04)
                `,
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontFamily: 'var(--font-inter)',
                overflow: 'hidden',
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Calendar Icon */}
                    <div
                        style={{
                            width: '28px',
                            height: '28px',
                            backgroundColor: '#3B82F6',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Calendar size={14} color="white" strokeWidth={2} />
                    </div>
                    <div>
                        <div style={{ fontSize: '10px', fontWeight: 600, color: '#1E293B' }}>Study Planner</div>
                        <div style={{ fontSize: '8px', color: '#64748B' }}>January 2026</div>
                    </div>
                </div>
                {/* Auto-scheduled badge */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '4px 8px',
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        border: '1px solid #E2E8F0',
                    }}
                >
                    <Sparkles size={9} color="#3B82F6" strokeWidth={2} />
                    <span style={{ fontSize: '7px', fontWeight: 500, color: '#3B82F6' }}>Auto-scheduled</span>
                </div>
            </div>

            {/* Week Calendar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
                {weekDays.map((item, index) => (
                    <div
                        key={index}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px',
                            padding: item.selected ? '5px 8px' : '5px 8px',
                            backgroundColor: item.selected ? '#3B82F6' : 'transparent',
                            borderRadius: '10px',
                        }}
                    >
                        <span style={{ fontSize: '7px', color: item.selected ? 'rgba(255,255,255,0.8)' : '#94A3B8' }}>
                            {item.day}
                        </span>
                        <span style={{ fontSize: '10px', fontWeight: 600, color: item.selected ? 'white' : '#1E293B' }}>
                            {item.date}
                        </span>
                    </div>
                ))}
            </div>

            {/* Today's Schedule Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#E2E8F0' }} />
                <span style={{ fontSize: '6px', fontWeight: 600, color: '#94A3B8', letterSpacing: '0.5px' }}>
                    TODAY&apos;S SCHEDULE
                </span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#E2E8F0' }} />
            </div>

            {/* Schedule Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, overflow: 'hidden' }}>
                {scheduleItems.map((item, index) => (
                    <div
                        key={index}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: 'white',
                            borderRadius: '10px',
                            padding: '8px',
                            gap: '8px',
                            border: '1px solid #F1F5F9',
                        }}
                    >
                        {/* Color bar */}
                        <div
                            style={{
                                width: '3px',
                                height: '24px',
                                backgroundColor: item.color,
                                borderRadius: '2px',
                            }}
                        />

                        {/* Time */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', minWidth: '50px' }}>
                            <Clock size={9} color="#94A3B8" strokeWidth={2} />
                            <span style={{ fontSize: '7px', color: '#64748B' }}>{item.time}</span>
                        </div>

                        {/* Divider */}
                        <div style={{ width: '1px', height: '16px', backgroundColor: '#E2E8F0' }} />

                        {/* Subject & Topic */}
                        <div style={{ flex: 1 }}>
                            <div style={{
                                fontSize: '9px',
                                fontWeight: 600,
                                color: item.completed ? '#94A3B8' : '#1E293B',
                                textDecoration: item.completed ? 'line-through' : 'none',
                            }}>
                                {item.subject}
                            </div>
                            <div style={{
                                fontSize: '7px',
                                color: item.completed ? '#94A3B8' : '#3B82F6',
                                textDecoration: item.completed ? 'line-through' : 'none',
                            }}>
                                {item.topic}
                            </div>
                        </div>

                        {/* Duration */}
                        <span style={{ fontSize: '7px', color: '#94A3B8' }}>{item.duration}</span>

                        {/* Checkbox - Blue for completed */}
                        <div
                            style={{
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                border: item.completed ? 'none' : '1.5px solid #E2E8F0',
                                backgroundColor: item.completed ? '#3B82F6' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            {item.completed && <Check size={8} color="white" strokeWidth={3} />}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer Stats */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '6px',
                    borderTop: '1px solid #E2E8F0',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3B82F6' }} />
                    <span style={{ fontSize: '7px', color: '#1E293B' }}>1 completed</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#CBD5E1' }} />
                    <span style={{ fontSize: '7px', color: '#64748B' }}>3 remaining</span>
                </div>
                <span style={{ fontSize: '7px', fontWeight: 500, color: '#1E293B' }}>2h 15m total</span>
            </div>
        </div>
    );
};

export default StudyPlannerMockup;
