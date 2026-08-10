/**
 * ContextNetwork.jsx — Abstract Context Intelligence Network Canvas Visualization.
 * High-performance, monochrome-driven background graphic representing CMIS data flow.
 * Supports ambient hero mode, login expansion mode, and logout contraction mode.
 */
import { useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

export default function ContextNetwork({ mode = 'hero', className = '' }) {
  const canvasRef = useRef(null);
  const { theme } = useTheme();
  const mouseRef = useRef({ x: -1000, y: -1000, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check reduced motion preference
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animId;
    let width = 0;
    let height = 0;
    let nodes = [];
    let pulses = [];

    const isDark = theme === 'dark' || document.documentElement.classList.contains('dark') || !document.documentElement.classList.contains('light');

    // Theme color parameters (Strictly Monochrome)
    const colors = isDark
      ? {
          grid: 'rgba(255, 255, 255, 0.03)',
          node: 'rgba(255, 255, 255, 0.45)',
          nodeHighlight: 'rgba(255, 255, 255, 0.9)',
          line: 'rgba(255, 255, 255, 0.07)',
          lineActive: 'rgba(255, 255, 255, 0.25)',
          pulse: 'rgba(255, 255, 255, 0.95)',
        }
      : {
          grid: 'rgba(0, 0, 0, 0.035)',
          node: 'rgba(0, 0, 0, 0.35)',
          nodeHighlight: 'rgba(0, 0, 0, 0.85)',
          line: 'rgba(0, 0, 0, 0.06)',
          lineActive: 'rgba(0, 0, 0, 0.22)',
          pulse: 'rgba(0, 0, 0, 0.85)',
        };

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      // Determine responsive node count
      let count = 28;
      if (width < 640) count = 8;
      else if (width < 1024) count = 16;

      initNodes(count);
    };

    const initNodes = (count) => {
      nodes = [];
      pulses = [];

      const centerX = width / 2;
      const centerY = height / 2;

      for (let i = 0; i < count; i++) {
        let x, y, vx, vy;

        if (mode === 'expand') {
          // Start clustered near center
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * 60;
          x = centerX + Math.cos(angle) * dist;
          y = centerY + Math.sin(angle) * dist;
          vx = Math.cos(angle) * (1.5 + Math.random() * 2);
          vy = Math.sin(angle) * (1.5 + Math.random() * 2);
        } else if (mode === 'contract') {
          // Start scattered, move toward center
          x = Math.random() * width;
          y = Math.random() * height;
          const angle = Math.atan2(centerY - y, centerX - x);
          vx = Math.cos(angle) * (1.2 + Math.random() * 1.5);
          vy = Math.sin(angle) * (1.2 + Math.random() * 1.5);
        } else {
          // Normal hero floating
          x = Math.random() * width;
          y = Math.random() * height;
          vx = (Math.random() - 0.5) * 0.4;
          vy = (Math.random() - 0.5) * 0.4;
        }

        nodes.push({
          x,
          y,
          baseX: x,
          baseY: y,
          vx,
          vy,
          radius: 2 + Math.random() * 1.5,
          pulsePhase: Math.random() * Math.PI * 2,
        });
      }
    };

    // Track mouse over hero container
    const handleMouseMove = (e) => {
      if (mode !== 'hero') return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvas);

    // Main render loop
    let lastTime = performance.now();

    const render = (now) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      // 1. Draw Technical Grid
      const gridSize = 48;
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Draw subtle grid crosshairs (+)
      for (let x = gridSize; x < width; x += gridSize * 2) {
        for (let y = gridSize; y < height; y += gridSize * 2) {
          ctx.beginPath();
          ctx.moveTo(x - 3, y);
          ctx.lineTo(x + 3, y);
          ctx.moveTo(x, y - 3);
          ctx.lineTo(x, y + 3);
          ctx.stroke();
        }
      }

      // 2. Update & Draw Nodes
      const maxDist = 130;
      const mouseDist = 120;

      // Update positions
      nodes.forEach((node) => {
        if (!reducedMotion) {
          node.x += node.vx;
          node.y += node.vy;
          node.pulsePhase += delta * 1.5;

          // Boundary bounce for hero mode
          if (mode === 'hero') {
            if (node.x < 10 || node.x > width - 10) node.vx *= -1;
            if (node.y < 10 || node.y > height - 10) node.vy *= -1;
          }

          // Subtle cursor interaction
          if (mode === 'hero' && mouseRef.current.active) {
            const dx = mouseRef.current.x - node.x;
            const dy = mouseRef.current.y - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < mouseDist && dist > 0) {
              const force = (1 - dist / mouseDist) * 1.2;
              node.x -= (dx / dist) * force;
              node.y -= (dy / dist) * force;
            }
          }
        }

        // Render node dot
        const alpha = Math.sin(node.pulsePhase) * 0.2 + 0.8;
        ctx.fillStyle = colors.node;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });

      // 3. Draw Connecting Lines & Spawn Signal Pulses
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDist) {
            const lineAlpha = (1 - dist / maxDist) * 0.8;
            ctx.strokeStyle = colors.line;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.stroke();

            // Randomly trigger signal pulses along connections
            if (!reducedMotion && Math.random() < 0.0015 && pulses.length < 6) {
              pulses.push({
                x1: n1.x,
                y1: n1.y,
                x2: n2.x,
                y2: n2.y,
                progress: 0,
                speed: 0.6 + Math.random() * 0.8,
              });
            }
          }
        }
      }

      // 4. Update & Draw Signal Pulses
      if (!reducedMotion) {
        for (let i = pulses.length - 1; i >= 0; i--) {
          const p = pulses[i];
          p.progress += delta * p.speed;
          if (p.progress >= 1) {
            pulses.splice(i, 1);
            continue;
          }

          const curX = p.x1 + (p.x2 - p.x1) * p.progress;
          const curY = p.y1 + (p.y2 - p.y1) * p.progress;

          ctx.fillStyle = colors.pulse;
          ctx.beginPath();
          ctx.arc(curX, curY, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (!reducedMotion) {
        animId = requestAnimationFrame(render);
      }
    };

    if (reducedMotion) {
      render(performance.now());
    } else {
      animId = requestAnimationFrame(render);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [mode, theme]);

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
