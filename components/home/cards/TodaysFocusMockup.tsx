import React from "react";
import { Search, Clock, ChevronDown, Check } from "lucide-react";

interface TodaysFocusMockupProps {
    animationStage?: number; // 0 = hidden, 1 = container, 2 = task 1, 3 = task 2, 4 = task 3, 5 = task 1 checked
}

// Task data
const tasks = [
    { title: "Complete Trigonometry worksheet", duration: "45 min", priority: "High", completed: false },
    { title: "Review Cell Biology notes", duration: "40 min", priority: "Medium", completed: false },
    { title: "Read Chapter 5 - Periodic Table", duration: "30 min", priority: "Medium", completed: false },
];

const TodaysFocusMockup = ({ animationStage = 5 }: TodaysFocusMockupProps) => {
    // Determine which tasks are visible and if first task is checked
    const isContainerVisible = animationStage >= 1;
    const isTask1Visible = animationStage >= 2;
    const isTask2Visible = animationStage >= 3;
    const isTask3Visible = animationStage >= 4;
    const isTask1Checked = animationStage >= 5;

    const taskVisibility = [isTask1Visible, isTask2Visible, isTask3Visible];

    return (
        <div
            style={{
                width: '340px',
                backgroundColor: '#F8FAFC',
                borderRadius: '20px',
                boxShadow: `
                    0 0 0 16px rgba(255, 255, 255, 0.4),
                    0 25px 50px rgba(0, 0, 0, 0.15),
                    0px 4px 8px rgba(0, 0, 0, 0.08)
                `,
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                fontFamily: 'var(--font-inter)',
                opacity: isContainerVisible ? 1 : 0,
                transform: isContainerVisible ? 'translate(0, 0)' : 'translate(40px, -40px)',
                transition: 'opacity 600ms ease-out, transform 700ms ease-out',
            }}
        >
            {/* Search Bar */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                }}
            >
                <Search size={16} color="#94A3B8" strokeWidth={2} />
                <span style={{ fontSize: '13px', color: '#94A3B8' }}>Search for subject</span>
            </div>

            {/* Today's Focus Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: 600, color: '#1E293B' }}>Today&apos;s Focus</span>
                <ChevronDown size={18} color="#94A3B8" strokeWidth={2} />
            </div>

            {/* Task List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tasks.map((task, index) => {
                    const isVisible = taskVisibility[index];
                    const isChecked = index === 0 && isTask1Checked;

                    return (
                        <div
                            key={index}
                            style={{
                                backgroundColor: 'white',
                                borderRadius: '12px',
                                padding: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                border: '1px solid #F1F5F9',
                                opacity: isVisible ? 1 : 0,
                                transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                                transition: 'opacity 400ms ease-out, transform 400ms ease-out',
                            }}
                        >
                            {/* Task Title Row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {/* Checkbox */}
                                <div
                                    style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '6px',
                                        border: isChecked ? 'none' : '2px solid #E2E8F0',
                                        backgroundColor: isChecked ? '#3B82F6' : 'transparent',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        transition: 'background-color 300ms ease-out, border 300ms ease-out',
                                    }}
                                >
                                    <div style={{
                                        opacity: isChecked ? 1 : 0,
                                        transform: isChecked ? 'scale(1)' : 'scale(0)',
                                        transition: 'opacity 200ms ease-out, transform 200ms ease-out',
                                    }}>
                                        <Check size={14} color="white" strokeWidth={3} />
                                    </div>
                                </div>
                                {/* Title */}
                                <span
                                    style={{
                                        fontSize: '15px',
                                        fontWeight: 500,
                                        color: isChecked ? '#94A3B8' : '#1E293B',
                                        textDecoration: isChecked ? 'line-through' : 'none',
                                        transition: 'color 300ms ease-out',
                                    }}
                                >
                                    {task.title}
                                </span>
                            </div>

                            {/* Duration & Priority Row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '36px' }}>
                                {/* Duration */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={14} color="#94A3B8" strokeWidth={2} />
                                    <span style={{ fontSize: '13px', color: '#64748B' }}>{task.duration}</span>
                                </div>
                                {/* Priority Badge */}
                                <div
                                    style={{
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        backgroundColor: task.priority === 'High' ? '#FEE2E2' : '#FEF3C7',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: '12px',
                                            fontWeight: 500,
                                            color: task.priority === 'High' ? '#EF4444' : '#F59E0B',
                                        }}
                                    >
                                        {task.priority}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TodaysFocusMockup;
