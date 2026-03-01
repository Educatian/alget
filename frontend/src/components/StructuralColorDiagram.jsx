import React, { useState } from 'react';

export const StructuralColorDiagram = () => {
    const [angle, setAngle] = useState(45); // viewing angle 0 to 90

    // Compute dynamic color based on angle (representing iridescence)
    // 0 = purple (short wavelength), 45 = bright blue, 90 = green (longer wavelength)
    const wavelength = 400 + (angle * 2); // roughly 400nm to 580nm

    // Simple hue calculation based on perceived wavelength shift
    const hue = 250 - (angle * 1.5);
    const currentColor = `hsl(${hue}, 80%, 50%)`;

    // Calculate reflection path logic
    const angleRad = (angle * Math.PI) / 180;
    const reflectionOffset = Math.sin(angleRad) * 40;

    return (
        <div className="my-8 p-6 bg-white border border-slate-200 rounded-xl drop-shadow-sm font-sans flex flex-col items-center">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Interactive: Photonic Crystal Iridescence</h3>
            <p className="text-sm text-slate-500 mb-6 text-center max-w-lg">
                Drag the slider to change your viewing angle. Because color is produced strictly by the physical structure reflecting light (not by pigment), the constructive interference wavelength shifts, causing the color to change dynamically (Iridescence).
            </p>

            <div className="w-full max-w-sm mb-6 flex flex-col items-center">
                <input
                    type="range"
                    min="0" max="90"
                    value={angle}
                    onChange={(e) => setAngle(Number(e.target.value))}
                    className="w-full mb-2"
                    style={{ accentColor: currentColor }}
                />
                <div className="flex justify-between w-full text-xs font-semibold text-slate-400">
                    <span>Shallow Angle</span>
                    <span>Straight On</span>
                </div>
            </div>

            <svg viewBox="0 0 600 300" className="w-full max-w-2xl bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                {/* Nano-Scale structure (cross-section of Morpho butterfly scale) */}
                <g fill="none" stroke="#64748b" strokeWidth="4">
                    <line x1="300" y1="280" x2="300" y2="100" />

                    {/* Tiny "Christmas tree" branches typical of Morpho scales */}
                    <line x1="200" y1="250" x2="400" y2="250" strokeWidth="8" />
                    <line x1="210" y1="200" x2="390" y2="200" strokeWidth="8" />
                    <line x1="220" y1="150" x2="380" y2="150" strokeWidth="8" />
                    <line x1="230" y1="100" x2="370" y2="100" strokeWidth="8" />
                </g>

                {/* Light waves bouncing (Dynamic based on angle) */}
                <g fill="none" strokeWidth="4" style={{ transition: 'all 0.1s linear' }}>
                    {/* Incoming White Light (Genericized to yellow/white dashes) */}
                    <path d={`M ${50 + reflectionOffset} 50 L 220 150`} stroke="#fef08a" strokeDasharray="5 5" opacity="0.5" />
                    <path d={`M ${50 + reflectionOffset} 100 L 220 200`} stroke="#fef08a" strokeDasharray="5 5" opacity="0.5" />

                    {/* Reflected Light - Constructive Interference */}
                    {/* The spacing of the sine wave acts as the "wavelength" visualization */}
                    <path d={`M 220 150 Q ${160 + reflectionOffset} 100 ${100 + reflectionOffset} 150 T ${50 + reflectionOffset} 150`} stroke={currentColor} />
                    <path d={`M 220 200 Q ${160 + reflectionOffset} 150 ${100 + reflectionOffset} 200 T ${50 + reflectionOffset} 200`} stroke={currentColor} />
                </g>

                {/* Destructive Interference representing cancelled colors (Red/Yellows) */}
                <g fill="none" strokeWidth="2" opacity="0.3">
                    <path d={`M 380 150 T 550 150`} stroke="#ef4444" strokeDasharray="2 4" />
                    <path d={`M 390 200 T 550 200`} stroke="#ef4444" strokeDasharray="2 4" />
                </g>

                <text x="120" y="270" textAnchor="middle" className="text-xs font-bold" fill={currentColor}>
                    Constructive Interference ({Math.round(wavelength)}nm)
                </text>
                <text x="470" y="270" textAnchor="middle" className="text-xs font-bold fill-red-800">
                    Destructive Interference (Absorbed/Cancelled)
                </text>

                <text x="300" y="40" textAnchor="middle" className="font-bold text-lg fill-white bg-slate-900 px-2 rounded">
                    Nano-Scale Photonic Crystal Matrix
                </text>
            </svg>
        </div>
    );
};
