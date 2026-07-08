"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Elemento 3D del hero: una forma abstracta (icosaedro geodésico) hecha de una malla
 * wireframe + nube de puntos, en el acento verde petróleo de ATLAS. Rota muy lento y
 * "respira", con una reacción sutil al puntero. Ligero a propósito:
 *   - devicePixelRatio limitado a 1.5 (nitidez sin castigar GPUs modestas).
 *   - se pausa cuando el hero sale de viewport o la pestaña se oculta (ahorro de batería).
 *   - respeta prefers-reduced-motion: pinta un único fotograma estático, sin bucle.
 *   - libera geometría/materiales/renderer al desmontar (sin fugas de memoria).
 * No es SSR-safe por diseño (usa WebGL/canvas) → se importa con ssr:false desde Hero.
 */
export default function HeroCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 4.4;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    // Grupo que contiene toda la forma (para rotarla como un todo).
    const group = new THREE.Group();
    scene.add(group);

    const TEAL = 0x2dd4bf;
    const BLUE = 0x38bdf8;

    // Base geométrica: icosaedro geodésico. Guardamos la posición original de cada
    // vértice para poder "respirarlo" sin acumular deriva numérica.
    const geometry = new THREE.IcosahedronGeometry(1.5, 4);
    const basePositions = geometry.attributes.position.array.slice() as Float32Array;

    // Wireframe tenue.
    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(geometry),
      new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.16 }),
    );
    group.add(wire);

    // Puntos en los vértices (los "nodos" de datos).
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: TEAL, size: 0.03, transparent: true, opacity: 0.9, sizeAttenuation: true }),
    );
    group.add(points);

    // Halo interior: una esfera translúcida azulada para dar profundidad.
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 32, 32),
      new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0.04 }),
    );
    group.add(halo);

    // Nube de partículas dispersas alrededor (polvo estelar sutil).
    const dustCount = 320;
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      const r = 2.2 + Math.random() * 2.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      dustPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      dustPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      dustPos[i * 3 + 2] = r * Math.cos(phi);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({ color: TEAL, size: 0.014, transparent: true, opacity: 0.4, sizeAttenuation: true }),
    );
    scene.add(dust);

    group.rotation.x = 0.5;

    // Puntero → objetivo de inclinación suave (parallax de la forma).
    const target = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 0.5;
      target.y = (e.clientY / window.innerHeight - 0.5) * 0.5;
    };
    if (!reduce) window.addEventListener("pointermove", onPointer, { passive: true });

    // Tamaño responsivo al contenedor.
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const posAttr = geometry.attributes.position;

    const render = (t: number) => {
      // Respiración de los vértices (desplazamiento radial senoidal muy leve).
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const bx = basePositions[i], by = basePositions[i + 1], bz = basePositions[i + 2];
        const wobble = 1 + Math.sin(t * 0.0009 + bx * 2 + by * 2) * 0.03;
        arr[i] = bx * wobble; arr[i + 1] = by * wobble; arr[i + 2] = bz * wobble;
      }
      posAttr.needsUpdate = true;

      group.rotation.y += 0.0016;
      group.rotation.x += (0.5 + target.y - group.rotation.x) * 0.03;
      group.rotation.z += (target.x - group.rotation.z) * 0.03;
      dust.rotation.y -= 0.0004;
      renderer.render(scene, camera);
    };

    let raf = 0;
    let running = false;
    const loop = (t: number) => {
      render(t);
      raf = requestAnimationFrame(loop);
    };
    const start = () => { if (!running && !reduce) { running = true; raf = requestAnimationFrame(loop); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    if (reduce) {
      render(0); // un fotograma estático y quieto
    } else {
      // Solo anima mientras el hero es visible.
      const io = new IntersectionObserver(
        ([entry]) => (entry.isIntersecting ? start() : stop()),
        { threshold: 0.05 },
      );
      io.observe(mount);
      const onVis = () => (document.hidden ? stop() : start());
      document.addEventListener("visibilitychange", onVis);

      return () => {
        stop();
        io.disconnect();
        document.removeEventListener("visibilitychange", onVis);
        window.removeEventListener("pointermove", onPointer);
        ro.disconnect();
        renderer.dispose();
        geometry.dispose();
        dustGeo.dispose();
        (wire.geometry as THREE.BufferGeometry).dispose();
        (wire.material as THREE.Material).dispose();
        (points.material as THREE.Material).dispose();
        (halo.geometry as THREE.BufferGeometry).dispose();
        (halo.material as THREE.Material).dispose();
        (dust.material as THREE.Material).dispose();
        mount.removeChild(renderer.domElement);
      };
    }

    // Cleanup del camino reduce-motion (sin bucle ni observers).
    return () => {
      window.removeEventListener("pointermove", onPointer);
      ro.disconnect();
      renderer.dispose();
      geometry.dispose();
      dustGeo.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} aria-hidden className="h-full w-full" />;
}
