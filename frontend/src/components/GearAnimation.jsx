import { useEffect, useRef } from 'react'

/**
 * Network/Plexus Animation - Sophisticated tech background
 */
export default function GearAnimation() {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        let animationId
        let particles = []
        let mouse = { x: null, y: null, radius: 150 }

        const resizeCanvas = () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
        }
        resizeCanvas()
        window.addEventListener('resize', resizeCanvas)

        // Particle class
        class Particle {
            constructor() {
                this.x = Math.random() * canvas.width
                this.y = Math.random() * canvas.height
                this.size = Math.random() * 2 + 1
                this.baseX = this.x
                this.baseY = this.y
                this.density = Math.random() * 30 + 1
                this.speedX = (Math.random() - 0.5) * 0.3
                this.speedY = (Math.random() - 0.5) * 0.3
            }

            draw() {
                ctx.fillStyle = 'rgba(158, 27, 50, 0.8)'
                ctx.beginPath()
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
                ctx.closePath()
                ctx.fill()
            }

            update() {
                // Mouse interaction
                if (mouse.x != null && mouse.y != null) {
                    const dx = mouse.x - this.x
                    const dy = mouse.y - this.y
                    const distance = Math.sqrt(dx * dx + dy * dy)
                    if (distance < mouse.radius) {
                        const forceDirectionX = dx / distance
                        const forceDirectionY = dy / distance
                        const force = (mouse.radius - distance) / mouse.radius
                        this.x -= forceDirectionX * force * this.density * 0.5
                        this.y -= forceDirectionY * force * this.density * 0.5
                    }
                }

                // Return to base
                const bx = this.baseX - this.x
                const by = this.baseY - this.y
                this.x += bx * 0.05
                this.y += by * 0.05

                // Slight drift
                this.baseX += this.speedX
                this.baseY += this.speedY

                if (this.baseX < 0 || this.baseX > canvas.width) this.speedX *= -1
                if (this.baseY < 0 || this.baseY > canvas.height) this.speedY *= -1
            }
        }

        // Initialize particles
        const initParticles = () => {
            particles = []
            const numberOfParticles = Math.min(100, (canvas.width * canvas.height) / 15000)
            for (let i = 0; i < numberOfParticles; i++) {
                particles.push(new Particle())
            }
        }
        initParticles()

        // Connect particles
        const connectParticles = () => {
            for (let a = 0; a < particles.length; a++) {
                for (let b = a + 1; b < particles.length; b++) {
                    const dx = particles[a].x - particles[b].x
                    const dy = particles[a].y - particles[b].y
                    const distance = Math.sqrt(dx * dx + dy * dy)

                    if (distance < 120) {
                        const opacity = 1 - distance / 120
                        ctx.strokeStyle = `rgba(158, 27, 50, ${opacity * 0.4})`
                        ctx.lineWidth = 1
                        ctx.beginPath()
                        ctx.moveTo(particles[a].x, particles[a].y)
                        ctx.lineTo(particles[b].x, particles[b].y)
                        ctx.stroke()
                    }
                }
            }
        }

        // Floating orbs
        const orbs = [
            { x: canvas.width * 0.2, y: canvas.height * 0.3, radius: 200, color: 'rgba(158, 27, 50, 0.1)' },
            { x: canvas.width * 0.8, y: canvas.height * 0.7, radius: 250, color: 'rgba(122, 21, 39, 0.08)' },
            { x: canvas.width * 0.5, y: canvas.height * 0.5, radius: 300, color: 'rgba(196, 30, 58, 0.05)' },
        ]

        const drawOrbs = () => {
            orbs.forEach(orb => {
                const gradient = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius)
                gradient.addColorStop(0, orb.color)
                gradient.addColorStop(1, 'transparent')
                ctx.fillStyle = gradient
                ctx.beginPath()
                ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2)
                ctx.fill()

                // Animate orb position slightly
                orb.x += Math.sin(Date.now() / 3000) * 0.3
                orb.y += Math.cos(Date.now() / 4000) * 0.3
            })
        }

        // Animation loop
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            drawOrbs()

            for (let i = 0; i < particles.length; i++) {
                particles[i].update()
                particles[i].draw()
            }
            connectParticles()

            animationId = requestAnimationFrame(animate)
        }

        // Mouse events
        const handleMouseMove = (e) => {
            mouse.x = e.clientX
            mouse.y = e.clientY
        }
        const handleMouseLeave = () => {
            mouse.x = null
            mouse.y = null
        }

        canvas.addEventListener('mousemove', handleMouseMove)
        canvas.addEventListener('mouseleave', handleMouseLeave)

        animate()

        return () => {
            cancelAnimationFrame(animationId)
            window.removeEventListener('resize', resizeCanvas)
            canvas.removeEventListener('mousemove', handleMouseMove)
            canvas.removeEventListener('mouseleave', handleMouseLeave)
        }
    }, [])

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-auto"
            style={{ zIndex: 0 }}
        />
    )
}
