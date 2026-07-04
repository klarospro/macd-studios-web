"use client";

import { useEffect, useRef } from "react";
import type { Material } from "three";

/**
 * Elemento 3D original de Atlas: una malla icosaédrica facetada que "respira" y rota
 * lentamente, en verde petróleo, con un halo de partículas. Vanilla Three.js cargado de
 * forma diferida (import dinámico dentro de useEffect → fuera del bundle inicial y del SSR).
 * Respeta prefers-reduced-motion (renderiza un único fotograma estático).
 */
export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let disposed = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      if (disposed) return;

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.z = 5.2;

      const teal = new THREE.Color("#2dd4bf");
      const blue = new THREE.Color("#38bdf8");

      // Malla facetada principal (wireframe) + relleno oscuro translúcido.
      const geo = new THREE.IcosahedronGeometry(1.7, 4);
      const base = Float32Array.from(geo.attributes.position.array);
      const fill = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: new THREE.Color("#0c1420"), metalness: 0.2, roughness: 0.6, flatShading: true, transparent: true, opacity: 0.85 }));
      const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: teal, wireframe: true, transparent: true, opacity: 0.28 }));
      const group = new THREE.Group();
      group.add(fill, wire);
      scene.add(group);

      // Halo de partículas.
      const pCount = 900;
      const pPos = new Float32Array(pCount * 3);
      for (let i = 0; i < pCount; i++) {
        const r = 2.4 + Math.random() * 2.6;
        const t = Math.random() * Math.PI * 2;
        const p = Math.acos(2 * Math.random() - 1);
        pPos[i * 3] = r * Math.sin(p) * Math.cos(t);
        pPos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
        pPos[i * 3 + 2] = r * Math.cos(p);
      }
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
      const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: blue, size: 0.02, transparent: true, opacity: 0.5, sizeAttenuation: true }));
      scene.add(points);

      const key = new THREE.PointLight(0x2dd4bf, 40, 20);
      key.position.set(3, 2, 4);
      const rim = new THREE.PointLight(0x38bdf8, 22, 20);
      rim.position.set(-4, -2, 2);
      scene.add(key, rim, new THREE.AmbientLight(0x223044, 1.2));

      const pos = geo.attributes.position;
      const v = new THREE.Vector3();

      const resize = () => {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (w === 0 || h === 0) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      window.addEventListener("resize", resize);

      const displace = (t: number) => {
        for (let i = 0; i < pos.count; i++) {
          const bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2];
          const n = Math.sin(bx * 2.5 + t) * Math.cos(by * 2.5 + t * 0.9) * Math.sin(bz * 2.5 + t * 1.1);
          const s = 1 + n * 0.09;
          pos.setXYZ(i, bx * s, by * s, bz * s);
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
      };

      const render = (t: number) => {
        displace(t * 0.0006);
        group.rotation.y = t * 0.00014;
        group.rotation.x = Math.sin(t * 0.0002) * 0.25;
        points.rotation.y = -t * 0.00006;
        renderer.render(scene, camera);
      };

      if (reduced) {
        render(1200);
      } else {
        const loop = (t: number) => {
          if (disposed) return;
          render(t);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      }

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        geo.dispose(); pGeo.dispose();
        (fill.material as Material).dispose();
        (wire.material as Material).dispose();
        (points.material as Material).dispose();
        renderer.dispose();
      };
    })();

    return () => { disposed = true; cleanup(); };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="h-full w-full" />;
}
