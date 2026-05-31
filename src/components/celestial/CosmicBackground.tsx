import { useEffect, useRef } from "react";

type Theme = "celestial" | "nature";

interface Star {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  spikes: number;
  color: string;
  twinkle: number;
  rotation: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  type: "trail" | "nebula";
}

interface Leaf {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  angle: number;
  angularSpeed: number;
  swayOffset: number;
  swaySpeed: number;
  swayRange: number;
  opacity: number;
}

const PARTICLE_CONFIG = {
  mouseTrail: { count: 15, lifetime: 1000, size: [2, 8] as const },
  nebula: {
    count: 8,
    spread: 80,
    colors: ["#7b2ff7", "#2f80ed", "#56ccf2", "#e040fb", "#c9a227", "#d4af37"],
  },
  stars: {
    small: 60,
    large: 12,
    colors: ["#ffffff", "#ffe9c4", "#d4d4ff", "#ffd4e8", "#b8d4ff", "#f3e5ab"],
  },
  nature: {
    leavesCount: 22,
    leafColors: [
      "#1b5e20", // Deep forest green
      "#2e7d32", // Medium dark green
      "#388e3c", // Vibrant green
      "#4caf50", // Soft grass green
      "#81c784", // Pale leaf green
      "#a5d6a7", // Light moss green
      "#c5e1a5", // Spring green
      "#d4af37", // Autumn gold touch
      "#e67e22", // Autumn orange touch
    ],
    sporeColors: [
      "#81c784", // Glowing green
      "#a5d6a7", // Soft light green
      "#c5e1a5", // Lime glow
      "#ffe57f", // Soft warm gold
      "#ffffff", // Core light
    ],
  },
};

// Math helpers
const lerp = (start: number, end: number, amt: number) => {
  return start + (end - start) * amt;
};

// Canvas drawing helpers
function drawSpikeStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation = 0
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  ctx.beginPath();
  const outerRadius = size;
  const innerRadius = size * 0.4;

  for (let i = 0; i < 8; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i * Math.PI) / 4;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  const secSize = size * 0.6;
  const secInner = secSize * 0.35;
  ctx.rotate(Math.PI / 4);

  for (let i = 0; i < 8; i++) {
    const radius = i % 2 === 0 ? secSize : secInner;
    const angle = (i * Math.PI) / 4;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  angle: number,
  color: string,
  opacity: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;

  ctx.beginPath();
  // Draw organic leaf shape using Bézier curves
  ctx.moveTo(0, -size / 2);
  ctx.quadraticCurveTo(-size / 2.3, -size / 8, 0, size / 2);
  ctx.quadraticCurveTo(size / 2.3, -size / 8, 0, -size / 2);
  ctx.closePath();
  ctx.fill();

  // Draw central leaf stem line
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -size / 2);
  ctx.lineTo(0, size / 2);
  ctx.stroke();

  ctx.restore();
}

function createNebulaParticle(
  x: number,
  y: number,
  theme: Theme = "celestial"
): Particle {
  const colors =
    theme === "nature"
      ? PARTICLE_CONFIG.nature.sporeColors
      : PARTICLE_CONFIG.nebula.colors;
  const color = colors[Math.floor(Math.random() * colors.length)]!;
  const angle = Math.random() * Math.PI * 2;
  const speed =
    theme === "nature" ? Math.random() * 1.0 + 0.3 : Math.random() * 2 + 0.5;

  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    // Spores float slightly upwards (negative vy)
    vy: Math.sin(angle) * speed + (theme === "nature" ? -0.22 : 0),
    size:
      Math.random() *
        (PARTICLE_CONFIG.mouseTrail.size[1] -
          PARTICLE_CONFIG.mouseTrail.size[0]) +
      PARTICLE_CONFIG.mouseTrail.size[0],
    color,
    life: 1,
    maxLife: Math.random() * 500 + PARTICLE_CONFIG.mouseTrail.lifetime,
    type: "nebula",
  };
}

function createLeaf(
  width: number,
  height: number,
  initScattered = false
): Leaf {
  const colors = PARTICLE_CONFIG.nature.leafColors;
  const color = colors[Math.floor(Math.random() * colors.length)]!;
  return {
    x: Math.random() * width,
    y: initScattered ? Math.random() * height : -30,
    vx: (Math.random() - 0.5) * 0.4,
    vy: Math.random() * 0.7 + 0.5,
    size: Math.random() * 10 + 11,
    color,
    angle: Math.random() * Math.PI * 2,
    angularSpeed: (Math.random() - 0.5) * 0.015,
    swayOffset: Math.random() * Math.PI * 2,
    swaySpeed: Math.random() * 0.012 + 0.006,
    swayRange: Math.random() * 20 + 15,
    opacity: Math.random() * 0.25 + 0.65,
  };
}

export default function CosmicBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -100, y: -100 });
  const mousePrevRef = useRef({ x: -100, y: -100 });
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<Star[]>([]);
  const leavesRef = useRef<Leaf[]>([]);
  const themeRef = useRef<Theme>("celestial");
  const transitionValRef = useRef(0); // 0 = celestial, 1 = nature
  const rafRef = useRef<number>(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Load initial preference from localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(
        "refugio-celestial:sanctuary-theme"
      ) as Theme | null;
      if (stored === "nature" || stored === "celestial") {
        themeRef.current = stored;
        transitionValRef.current = stored === "nature" ? 1 : 0;
      }
    }

    const initStars = (width: number, height: number) => {
      starsRef.current = [];
      for (let i = 0; i < PARTICLE_CONFIG.stars.small; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 0.05 + 0.01;
        starsRef.current.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 2 + 0.5,
          spikes: 0,
          color:
            PARTICLE_CONFIG.stars.colors[
              Math.floor(Math.random() * PARTICLE_CONFIG.stars.colors.length)
            ]!,
          twinkle: Math.random() * Math.PI * 2,
          rotation: 0,
        });
      }

      for (let i = 0; i < PARTICLE_CONFIG.stars.large; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 0.08 + 0.02;
        starsRef.current.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 3 + 4,
          spikes: 4,
          color:
            PARTICLE_CONFIG.stars.colors[
              Math.floor(Math.random() * PARTICLE_CONFIG.stars.colors.length)
            ]!,
          twinkle: Math.random() * Math.PI * 2,
          rotation: (Math.random() * Math.PI) / 4,
        });
      }
    };

    const initLeaves = (width: number, height: number) => {
      leavesRef.current = [];
      for (let i = 0; i < PARTICLE_CONFIG.nature.leavesCount; i++) {
        leavesRef.current.push(createLeaf(width, height, true));
      }
    };

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      initStars(w, h);
      initLeaves(w, h);
    };

    const onPointer = (clientX: number, clientY: number) => {
      mouseRef.current = { x: clientX, y: clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      onPointer(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) onPointer(t.clientX, t.clientY);
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -100, y: -100 };
    };

    const handleTouchEnd = () => {
      mouseRef.current = { x: -100, y: -100 };
    };

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: Theme }>;
      if (customEvent.detail && (customEvent.detail.theme === "celestial" || customEvent.detail.theme === "nature")) {
        themeRef.current = customEvent.detail.theme;
      }
    };

    const tick = () => {
      const width = canvas.width;
      const height = canvas.height;
      if (width < 1 || height < 1) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // 1. Transition progress increment/decrement
      if (themeRef.current === "nature") {
        transitionValRef.current = Math.min(1, transitionValRef.current + 0.024);
      } else {
        transitionValRef.current = Math.max(0, transitionValRef.current - 0.024);
      }

      const tVal = transitionValRef.current;

      // 2. Linear Color Interpolation for Liquid Gradient Backdrop
      // Celestial Color 1: #0a0a1e (10, 10, 30) -> Nature: #06200f (6, 32, 15)
      const r1 = Math.round(lerp(10, 6, tVal));
      const g1 = Math.round(lerp(10, 32, tVal));
      const b1 = Math.round(lerp(30, 15, tVal));

      // Celestial Color 2: #0d0d32 (13, 13, 50) -> Nature: #031208 (3, 18, 8)
      const r2 = Math.round(lerp(13, 3, tVal));
      const g2 = Math.round(lerp(13, 18, tVal));
      const b2 = Math.round(lerp(50, 8, tVal));

      // Celestial Color 3: #060612 (6, 6, 18) -> Nature: #010603 (1, 6, 3)
      const r3 = Math.round(lerp(6, 1, tVal));
      const g3 = Math.round(lerp(6, 6, tVal));
      const b3 = Math.round(lerp(18, 3, tVal));

      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, `rgb(${r1}, ${g1}, ${b1})`);
      gradient.addColorStop(0.45, `rgb(${r2}, ${g2}, ${b2})`);
      gradient.addColorStop(1, `rgb(${r3}, ${g3}, ${b3})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      const { x: mouseX, y: mouseY } = mouseRef.current;
      frameRef.current += 1;

      // 3. Spores (Nature) and Nebula (Celestial) Pointer Trail Generation
      if (mouseX > 0 && mouseY > 0 && frameRef.current % 5 === 0) {
        for (let i = 0; i < 2; i++) {
          particlesRef.current.push(
            createNebulaParticle(
              mouseX + (Math.random() - 0.5) * PARTICLE_CONFIG.nebula.spread,
              mouseY + (Math.random() - 0.5) * PARTICLE_CONFIG.nebula.spread,
              themeRef.current
            )
          );
        }
      }

      // 4. Update Spores / Nebula trails
      particlesRef.current = particlesRef.current.filter((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= 0.012;

        if (particle.life <= 0) return false;

        const g = ctx.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          particle.size
        );
        g.addColorStop(0, `${particle.color}55`);
        g.addColorStop(0.5, `${particle.color}22`);
        g.addColorStop(1, "transparent");

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();

        return true;
      });

      if (particlesRef.current.length > 120) {
        particlesRef.current = particlesRef.current.slice(-90);
      }

      // 5. Render Stars (Fade out based on transition to Nature)
      if (tVal < 0.99) {
        const starAlphaScale = 1 - tVal;
        starsRef.current.forEach((star) => {
          star.x += star.vx;
          star.y += star.vy;

          if (star.x < -24) {
            star.x = width + 24;
            star.y = Math.random() * height;
          } else if (star.x > width + 24) {
            star.x = -24;
            star.y = Math.random() * height;
          }
          if (star.y < -24) {
            star.y = height + 24;
            star.x = Math.random() * width;
          } else if (star.y > height + 24) {
            star.y = -24;
            star.x = Math.random() * width;
          }

          star.twinkle += 0.02;
          const alpha = (0.45 + Math.sin(star.twinkle) * 0.45) * starAlphaScale;

          if (star.spikes === 4) {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.shadowBlur = star.size * 3;
            ctx.shadowColor = star.color;
            ctx.fillStyle = star.color;
            drawSpikeStar(ctx, star.x, star.y, star.size, star.rotation);
            ctx.shadowBlur = 0;
            ctx.restore();
          } else {
            ctx.save();
            ctx.globalAlpha = alpha;
            const g = ctx.createRadialGradient(
              star.x,
              star.y,
              0,
              star.x,
              star.y,
              star.size * 3
            );
            g.addColorStop(0, star.color);
            g.addColorStop(0.45, `${star.color}99`);
            g.addColorStop(1, "transparent");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size * 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        });
      }

      // 6. Interactive Leaf Wind Physics and Rendering (Nature theme)
      if (tVal > 0.01) {
        if (leavesRef.current.length < PARTICLE_CONFIG.nature.leavesCount) {
          leavesRef.current.push(createLeaf(width, height, false));
        }

        // Calculate mouse movement speed vector for interactive leaf blowing
        const prevMouse = mousePrevRef.current;
        const dx = mouseX - prevMouse.x;
        const dy = mouseY - prevMouse.y;
        const speed = Math.sqrt(dx * dx + dy * dy);

        leavesRef.current.forEach((leaf) => {
          // Normal drifting/falling motion
          leaf.y += leaf.vy;
          leaf.swayOffset += leaf.swaySpeed;
          // Sine wave horizontal drifting
          const sway = Math.sin(leaf.swayOffset) * leaf.swayRange * 0.025;
          leaf.x += leaf.vx + sway;

          // Gentle rotation
          leaf.angle += leaf.angularSpeed;

          // Apply local mouse wind gust force
          if (mouseX > 0 && mouseY > 0 && speed > 1) {
            const dist = Math.sqrt((leaf.x - mouseX) ** 2 + (leaf.y - mouseY) ** 2);
            if (dist < 160) {
              const force = (160 - dist) / 160; // stronger closer to the cursor
              // Push leaves in mouse direction
              leaf.x += (dx / speed) * force * 5.5;
              leaf.y += (dy / speed) * force * 3.5;
              leaf.angle += (dx > 0 ? 0.07 : -0.07) * force;
            }
          }

          // If leaves glide off viewport, recycle them smoothly from the top
          if (leaf.y > height + 25 || leaf.x < -25 || leaf.x > width + 25) {
            Object.assign(leaf, createLeaf(width, height, false));
          }

          // Render leaf with fading opacity based on current transition progress
          drawLeaf(
            ctx,
            leaf.x,
            leaf.y,
            leaf.size,
            leaf.angle,
            leaf.color,
            leaf.opacity * tVal
          );
        });

        // Update mouse position reference
        mousePrevRef.current = { x: mouseX, y: mouseY };
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);
    window.addEventListener("refugio-sanctuary-changed", handleThemeChange);

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
      window.removeEventListener("refugio-sanctuary-changed", handleThemeChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      aria-hidden
      style={{ background: "#060612" }}
    />
  );
}
