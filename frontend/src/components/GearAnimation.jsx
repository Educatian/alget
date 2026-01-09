import { useState, useEffect, useRef } from 'react'

// Gear Animation Component - Mechanical Engineering Vibe
export default function GearAnimation() {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        const width = canvas.width = window.innerWidth
        const height = canvas.height = 600

        // Gear class
        class Gear {
            constructor(x, y, radius, teeth, speed, color) {
                this.x = x
                this.y = y
                this.radius = radius
                this.teeth = teeth
                this.speed = speed
                this.color = color
                this.angle = Math.random() * Math.PI * 2
                this.toothHeight = radius * 0.15
            }

            draw(ctx) {
                ctx.save()
                ctx.translate(this.x, this.y)
                ctx.rotate(this.angle)

                // Draw outer ring
                ctx.beginPath()
                ctx.arc(0, 0, this.radius, 0, Math.PI * 2)
                ctx.strokeStyle = this.color
                ctx.lineWidth = 3
                ctx.stroke()

                // Draw teeth
                for (let i = 0; i < this.teeth; i++) {
                    const toothAngle = (i / this.teeth) * Math.PI * 2
                    const innerX = Math.cos(toothAngle) * this.radius
                    const innerY = Math.sin(toothAngle) * this.radius
                    const outerX = Math.cos(toothAngle) * (this.radius + this.toothHeight)
                    const outerY = Math.sin(toothAngle) * (this.radius + this.toothHeight)

                    ctx.beginPath()
                    ctx.moveTo(innerX, innerY)
                    ctx.lineTo(outerX, outerY)
                    ctx.strokeStyle = this.color
                    ctx.lineWidth = 4
                    ctx.stroke()
                }

                // Draw center
                ctx.beginPath()
                ctx.arc(0, 0, this.radius * 0.2, 0, Math.PI * 2)
                ctx.fillStyle = this.color
                ctx.fill()

                ctx.restore()
            }

            update() {
                this.angle += this.speed
            }
        }

        // Particle class for background
        class Particle {
            constructor() {
                this.reset()
            }

            reset() {
                this.x = Math.random() * width
                this.y = Math.random() * height
                this.size = Math.random() * 3 + 1
                this.speedX = (Math.random() - 0.5) * 0.5
                this.speedY = (Math.random() - 0.5) * 0.5
                this.opacity = Math.random() * 0.5 + 0.1
            }

            draw(ctx) {
                ctx.beginPath()
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
                ctx.fillStyle = `rgba(158, 27, 50, ${this.opacity})`
                ctx.fill()
            }

            update() {
                this.x += this.speedX
                this.y += this.speedY
                if (this.x < 0 || this.x > width || this.y < 0 || this.y > height) {
                    this.reset()
                }
            }
        }

        // Create gears
        const gears = [
            new Gear(width * 0.15, 150, 60, 12, 0.01, 'rgba(158, 27, 50, 0.3)'),
            new Gear(width * 0.15 + 85, 150, 40, 8, -0.015, 'rgba(158, 27, 50, 0.25)'),
            new Gear(width * 0.85, 200, 80, 16, -0.008, 'rgba(158, 27, 50, 0.2)'),
            new Gear(width * 0.85 - 60, 280, 35, 7, 0.018, 'rgba(158, 27, 50, 0.25)'),
            new Gear(width * 0.5, 100, 50, 10, 0.012, 'rgba(158, 27, 50, 0.15)'),
        ]

        // Create particles
        const particles = Array.from({ length: 50 }, () => new Particle())

        // Animation loop
        let animationId
        const animate = () => {
            ctx.clearRect(0, 0, width, height)

            // Draw particles
            particles.forEach(p => {
                p.update()
                p.draw(ctx)
            })

            // Draw gears
            gears.forEach(g => {
                g.update()
                g.draw(ctx)
            })

            animationId = requestAnimationFrame(animate)
        }

        animate()

        return () => cancelAnimationFrame(animationId)
    }, [])

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none opacity-50"
            style={{ zIndex: 0 }}
        />
    )
}
