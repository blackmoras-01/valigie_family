'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

interface City {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

interface CityCount {
  small: number;
  large: number;
}

const CITIES: City[] = [
  { id: 'milan',     name: 'Milan',     lat: 45.4654, lon:  9.1859 },
  { id: 'eindhoven', name: 'Eindhoven', lat: 51.4416, lon:  5.4697 },
  { id: 'barcelona', name: 'Barcelona', lat: 41.3851, lon:  2.1734 },
  { id: 'zanzibar',  name: 'Zanzibar',  lat: -6.1659, lon: 39.2026 },
];

const DEFAULT_COUNTS: Record<string, CityCount> = {
  milan:     { small: 0, large: 0 },
  eindhoven: { small: 0, large: 0 },
  barcelona: { small: 0, large: 0 },
  zanzibar:  { small: 0, large: 0 },
};

interface PopupState {
  visible: boolean;
  cityId: string;
  cityName: string;
  small: number;
  large: number;
  x: number;
  y: number;
}

function latLonToVec3(lat: number, lon: number, r = 1.012): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  );
}

function badgeText(c: CityCount): string {
  const total = c.small + c.large;
  if (total === 0) return '0';
  const parts: string[] = [];
  if (c.small > 0) parts.push(`${c.small}S`);
  if (c.large > 0) parts.push(`${c.large}L`);
  return parts.join(' ');
}

export default function Globe() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const popupElRef = useRef<HTMLDivElement>(null);

  const countsRef = useRef<Record<string, CityCount>>({ ...DEFAULT_COUNTS });

  const sceneRef = useRef<{
    globeGroup: THREE.Group;
    camera: THREE.PerspectiveCamera;
    pinMeshes: THREE.Mesh[];
  } | null>(null);

  const [popup, setPopup] = useState<PopupState>({
    visible: false, cityId: '', cityName: '', small: 0, large: 0, x: 0, y: 0,
  });

  const popupRef = useRef(popup);
  useEffect(() => { popupRef.current = popup; }, [popup]);

  const refreshBadge = useCallback((cityId: string) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const el = overlay.querySelector(`[data-city="${cityId}"] .badge-num`) as HTMLElement | null;
    if (el) el.textContent = badgeText(countsRef.current[cityId] ?? { small: 0, large: 0 });
  }, []);

  const openPopup = useCallback((city: City, pinMesh: THREE.Mesh) => {
    const sc = sceneRef.current;
    if (!sc) return;
    const worldPos = pinMesh.position.clone();
    sc.globeGroup.localToWorld(worldPos);
    worldPos.project(sc.camera);
    const x = (worldPos.x + 1) / 2 * window.innerWidth;
    const y = (-worldPos.y + 1) / 2 * window.innerHeight;
    const c = countsRef.current[city.id] ?? { small: 0, large: 0 };
    setPopup({ visible: true, cityId: city.id, cityName: city.name, small: c.small, large: c.large, x, y });
  }, []);

  const closePopup = useCallback(() => {
    setPopup(p => ({ ...p, visible: false }));
  }, []);

  const updateCount = useCallback(async (cityId: string, type: 'small' | 'large', delta: number) => {
    const cur = countsRef.current[cityId] ?? { small: 0, large: 0 };
    const next: CityCount = {
      small: type === 'small' ? Math.max(0, cur.small + delta) : cur.small,
      large: type === 'large' ? Math.max(0, cur.large + delta) : cur.large,
    };
    countsRef.current = { ...countsRef.current, [cityId]: next };
    setPopup(p => ({ ...p, small: next.small, large: next.large }));
    refreshBadge(cityId);

    try {
      await fetch('/api/luggage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cityId, small: next.small, large: next.large }),
      });
    } catch {
      console.warn('Could not save to server.');
    }
  }, [refreshBadge]);

  useEffect(() => {
    const canvas  = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;

    // ── Renderer ──────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    // ── Scene / Camera ─────────────────────────────────────────────────────
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 2.8;

    // ── Lights ─────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x1a3a6b, 3));
    const sun = new THREE.DirectionalLight(0x6699ff, 2);
    sun.position.set(5, 3, 5);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x00d4ff, 0.6);
    rim.position.set(-5, -3, -5);
    scene.add(rim);

    // ── Stars ──────────────────────────────────────────────────────────────
    const starVerts: number[] = [];
    for (let i = 0; i < 6000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 80 + Math.random() * 20;
      starVerts.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      );
    }
    const starsGeom = new THREE.BufferGeometry();
    starsGeom.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
    scene.add(new THREE.Points(starsGeom, new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 })));

    // ── Globe group ────────────────────────────────────────────────────────
    const globeGroup = new THREE.Group();
    globeGroup.rotation.y = -Math.PI / 2;
    scene.add(globeGroup);

    // ── Earth sphere ───────────────────────────────────────────────────────
    const texLoader = new THREE.TextureLoader();
    const earthTex  = texLoader.load('/earth-dark.jpg');
    globeGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshPhongMaterial({
        map: earthTex,
        specular: new THREE.Color(0x1a3a5c),
        shininess: 12,
        emissive: new THREE.Color(0x020810),
      }),
    ));

    // ── Atmosphere glow ────────────────────────────────────────────────────
    globeGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.07, 64, 64),
      new THREE.MeshPhongMaterial({
        color: 0x0033bb, transparent: true, opacity: 0.06,
        side: THREE.FrontSide, blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    ));

    // ── Pins ───────────────────────────────────────────────────────────────
    const pinMeshes: THREE.Mesh[] = [];
    const pinCityMap = new Map<string, City>();
    const pulseRings: THREE.Mesh[] = [];

    CITIES.forEach((city, idx) => {
      const pos = latLonToVec3(city.lat, city.lon);

      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.022, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x00d4ff }),
      );
      dot.position.copy(pos);
      pinCityMap.set(dot.uuid, city);
      globeGroup.add(dot);
      pinMeshes.push(dot);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.028, 0.042, 32),
        new THREE.MeshBasicMaterial({
          color: 0x00d4ff, transparent: true, opacity: 0.5,
          side: THREE.DoubleSide, depthWrite: false,
        }),
      );
      ring.position.copy(pos);
      ring.lookAt(pos.clone().multiplyScalar(2));
      ring.userData.phaseOffset = idx * 1.3;
      globeGroup.add(ring);
      pulseRings.push(ring);

      const badge = document.createElement('div');
      badge.className = 'pin-badge';
      badge.dataset.city = city.id;
      badge.innerHTML = `<span class="badge-num">0</span>`;
      badge.addEventListener('click', e => { e.stopPropagation(); openPopup(city, dot); });
      overlay.appendChild(badge);
    });

    sceneRef.current = { globeGroup, camera, pinMeshes };

    // ── Drag & inertia ─────────────────────────────────────────────────────
    let dragging = false, dragMoved = false;
    let prev = { x: 0, y: 0 };
    let vel  = { x: 0, y: 0 };

    function getXY(e: MouseEvent | TouchEvent) {
      if ('touches' in e) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      return { x: e.clientX, y: e.clientY };
    }

    function onDown(e: MouseEvent | TouchEvent) {
      const p = getXY(e);
      dragging = true; dragMoved = false;
      prev = { ...p }; vel = { x: 0, y: 0 };
    }

    function onMove(e: MouseEvent | TouchEvent) {
      if (!dragging) return;
      const p = getXY(e);
      const dx = p.x - prev.x, dy = p.y - prev.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMoved = true;
      vel.x = dy * 0.005; vel.y = dx * 0.005;
      globeGroup.rotation.x = Math.max(-1.2, Math.min(1.2, globeGroup.rotation.x + vel.x));
      globeGroup.rotation.y += vel.y;
      prev = { ...p };
    }

    function onUp(e: MouseEvent | TouchEvent) {
      if (!dragging) return;
      dragging = false;
      if (dragMoved) { setPopup(p => ({ ...p, visible: false })); return; }

      const raw = 'changedTouches' in e ? e.changedTouches[0] : e;
      const mouse = new THREE.Vector2(
        (raw.clientX / window.innerWidth)  *  2 - 1,
        (raw.clientY / window.innerHeight) * -2 + 1,
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(mouse, camera);
      const hits = ray.intersectObjects(pinMeshes);
      if (hits.length > 0) {
        const city = pinCityMap.get((hits[0].object as THREE.Mesh).uuid);
        if (city) openPopup(city, hits[0].object as THREE.Mesh);
      } else {
        setPopup(p => ({ ...p, visible: false }));
      }
    }

    canvas.addEventListener('mousedown',  onDown);
    canvas.addEventListener('mousemove',  onMove);
    canvas.addEventListener('mouseup',    onUp);
    canvas.addEventListener('touchstart', onDown, { passive: true });
    canvas.addEventListener('touchmove',  onMove, { passive: true });
    canvas.addEventListener('touchend',   onUp);

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);

    // ── Animation loop ─────────────────────────────────────────────────────
    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      if (!dragging) {
        globeGroup.rotation.x = Math.max(-1.2, Math.min(1.2, globeGroup.rotation.x + vel.x));
        globeGroup.rotation.y += vel.y;
        vel.x *= 0.96; vel.y *= 0.96;
      }
      const t = Date.now() * 0.002;
      pulseRings.forEach(ring => {
        (ring.material as THREE.MeshBasicMaterial).opacity =
          0.25 + 0.35 * Math.sin(t + (ring.userData.phaseOffset as number));
      });
      CITIES.forEach((city, idx) => {
        const pin   = pinMeshes[idx];
        const badge = overlay.querySelector(`[data-city="${city.id}"]`) as HTMLElement | null;
        if (!badge || !pin) return;
        const worldPos = pin.position.clone();
        globeGroup.localToWorld(worldPos);
        const normal = worldPos.clone().normalize();
        const toCam  = camera.position.clone().sub(worldPos).normalize();
        if (normal.dot(toCam) < 0.08) { badge.style.display = 'none'; return; }
        worldPos.project(camera);
        badge.style.display = 'flex';
        badge.style.left = `${(worldPos.x + 1) / 2 * window.innerWidth}px`;
        badge.style.top  = `${(-worldPos.y + 1) / 2 * window.innerHeight}px`;
      });
      renderer.render(scene, camera);
    };
    animate();

    // ── Load data client-side ──────────────────────────────────────────────
    fetch('/api/luggage')
      .then(r => r.json())
      .then((data: Record<string, CityCount>) => {
        countsRef.current = { ...DEFAULT_COUNTS, ...data };
        CITIES.forEach(city => {
          const el = overlay.querySelector(`[data-city="${city.id}"] .badge-num`) as HTMLElement | null;
          if (el) el.textContent = badgeText(countsRef.current[city.id] ?? { small: 0, large: 0 });
        });
      })
      .catch(() => {});

    return () => {
      cancelAnimationFrame(rafId);
      renderer.dispose();
      canvas.removeEventListener('mousedown',  onDown);
      canvas.removeEventListener('mousemove',  onMove);
      canvas.removeEventListener('mouseup',    onUp);
      canvas.removeEventListener('touchstart', onDown);
      canvas.removeEventListener('touchmove',  onMove);
      canvas.removeEventListener('touchend',   onUp);
      window.removeEventListener('resize', onResize);
      overlay.innerHTML = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full" style={{ cursor: 'grab' }} />
      <div ref={overlayRef} className="fixed inset-0 pointer-events-none" />

      {popup.visible && (
        <div
          ref={popupElRef}
          className="pin-popup"
          style={{ left: popup.x, top: popup.y }}
          onClick={e => e.stopPropagation()}
        >
          <button className="popup-close" onClick={closePopup}>×</button>
          <p className="popup-city">{popup.cityName}</p>

          {/* Small suitcase row */}
          <div className="luggage-row">
            <div className="luggage-label">
              <span className="luggage-icon">🧳</span>
              <span className="luggage-type-text">Small · 15 kg</span>
            </div>
            <div className="luggage-controls">
              <button className="popup-btn" onClick={() => updateCount(popup.cityId, 'small', -1)} disabled={popup.small <= 0}>−</button>
              <span className="popup-count">{popup.small}</span>
              <button className="popup-btn" onClick={() => updateCount(popup.cityId, 'small', 1)}>+</button>
            </div>
          </div>

          <div className="popup-divider" />

          {/* Large suitcase row */}
          <div className="luggage-row">
            <div className="luggage-label">
              <span className="luggage-icon">🧳</span>
              <span className="luggage-type-text">Large · 23 kg</span>
            </div>
            <div className="luggage-controls">
              <button className="popup-btn" onClick={() => updateCount(popup.cityId, 'large', -1)} disabled={popup.large <= 0}>−</button>
              <span className="popup-count">{popup.large}</span>
              <button className="popup-btn" onClick={() => updateCount(popup.cityId, 'large', 1)}>+</button>
            </div>
          </div>
        </div>
      )}

      <header className="site-header">
        <h1>VALIGIE</h1>
        <p>Family Luggage Tracker</p>
      </header>
    </>
  );
}
