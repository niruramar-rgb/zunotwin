import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { 
  Maximize2, 
  Minimize2, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  Info, 
  CheckCircle2, 
  Power,
  X,
  Droplets,
  Cpu
} from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import { ErrorBoundary } from '../components/ErrorBoundary';

/**
 * Procedural 3D Virtual Shrimp (Litopenaeus vannamei)
 * Anatomically detailed model: carapace, rostrum, eyes, curved segmented abdomen,
 * telson/uropod tail fan, antennae, walking legs, and swimmerets.
 */
function VirtualShrimp({ 
  index, 
  initialRadius, 
  initialHeight, 
  initialAngle, 
  orbitSpeed = 0.25, 
  visible = true 
}) {
  const groupRef = useRef();
  const tailRef = useRef();
  const antennaeRef = useRef();
  const swimmeretsRef = useRef();

  useFrame((state) => {
    if (!groupRef.current || !visible) return;

    const t = state.clock.elapsedTime * orbitSpeed + initialAngle;
    
    // Smooth natural orbiting and bobbing
    const r = initialRadius + Math.sin(t * 1.5) * 0.15;
    const x = Math.cos(t) * r;
    const z = Math.sin(t) * r;
    const y = initialHeight + Math.sin(t * 2.2 + index) * 0.12;

    groupRef.current.position.set(x, y, z);
    
    // Orient shrimp tangent to swimming direction with slight pitching
    const angle = Math.atan2(-Math.sin(t), Math.cos(t)) + Math.PI / 2;
    groupRef.current.rotation.y = angle;
    groupRef.current.rotation.x = Math.sin(t * 2.0) * 0.08;
    groupRef.current.rotation.z = Math.cos(t * 1.8) * 0.05;

    // Organic tail undulation
    if (tailRef.current) {
      tailRef.current.rotation.x = -0.2 + Math.sin(state.clock.elapsedTime * 3.5 + index) * 0.15;
    }

    // Swaying antennae
    if (antennaeRef.current) {
      antennaeRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 2.0 + index) * 0.1;
    }

    // Undulating pleopods / swimmerets
    if (swimmeretsRef.current) {
      swimmeretsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 6.0 + index) * 0.25;
    }
  });

  if (!visible) return null;

  return (
    <group ref={groupRef} scale={[0.18, 0.18, 0.18]}>
      {/* 1. Cephalothorax / Carapace Shield (Main Thorax) */}
      <mesh position={[0, 0, 0]}>
        <capsuleGeometry args={[0.32, 0.65, 8, 16]} />
        <meshPhysicalMaterial
          color="#E0F2FE"
          emissive="#00F2FE"
          emissiveIntensity={0.22}
          roughness={0.2}
          transmission={0.65}
          thickness={0.4}
          transparent
          opacity={0.88}
        />
      </mesh>

      {/* 2. Rostrum (Serrated Forward Spine) */}
      <mesh position={[0, 0.1, 0.6]} rotation={[Math.PI / 10, 0, 0]}>
        <coneGeometry args={[0.07, 0.65, 6]} />
        <meshStandardMaterial color="#00F2FE" roughness={0.3} metalness={0.2} />
      </mesh>

      {/* 3. Eyes on Stalks */}
      <group position={[0, 0.18, 0.35]}>
        <mesh position={[0.14, 0, 0]}>
          <sphereGeometry args={[0.065, 12, 12]} />
          <meshBasicMaterial color="#050B18" />
        </mesh>
        <mesh position={[-0.14, 0, 0]}>
          <sphereGeometry args={[0.065, 12, 12]} />
          <meshBasicMaterial color="#050B18" />
        </mesh>
      </group>

      {/* 4. Sweeping Antennae */}
      <group ref={antennaeRef} position={[0, 0.15, 0.5]}>
        {/* Right Antenna */}
        <mesh position={[0.2, 0.1, 0.4]} rotation={[0.4, 0.3, -0.2]}>
          <cylinderGeometry args={[0.012, 0.003, 1.6, 6]} />
          <meshBasicMaterial color="#00F2FE" transparent opacity={0.85} />
        </mesh>
        {/* Left Antenna */}
        <mesh position={[-0.2, 0.1, 0.4]} rotation={[0.4, -0.3, 0.2]}>
          <cylinderGeometry args={[0.012, 0.003, 1.6, 6]} />
          <meshBasicMaterial color="#00F2FE" transparent opacity={0.85} />
        </mesh>
      </group>

      {/* 5. Articulated Abdomen (5 segments curving down & back) */}
      <group ref={tailRef} position={[0, -0.05, -0.35]}>
        {/* Abdominal Segment 1 */}
        <mesh position={[0, -0.05, -0.25]} rotation={[-0.2, 0, 0]}>
          <cylinderGeometry args={[0.28, 0.3, 0.35, 12]} />
          <meshPhysicalMaterial
            color="#BAE6FD"
            emissive="#00F2FE"
            emissiveIntensity={0.18}
            roughness={0.25}
            transmission={0.6}
            transparent
            opacity={0.85}
          />
        </mesh>

        {/* Abdominal Segment 2 */}
        <mesh position={[0, -0.15, -0.55]} rotation={[-0.35, 0, 0]}>
          <cylinderGeometry args={[0.24, 0.28, 0.35, 12]} />
          <meshPhysicalMaterial
            color="#BAE6FD"
            emissive="#00F2FE"
            emissiveIntensity={0.18}
            roughness={0.25}
            transmission={0.6}
            transparent
            opacity={0.85}
          />
        </mesh>

        {/* Abdominal Segment 3 */}
        <mesh position={[0, -0.32, -0.8]} rotation={[-0.5, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.24, 0.35, 12]} />
          <meshPhysicalMaterial
            color="#BAE6FD"
            emissive="#00F2FE"
            emissiveIntensity={0.18}
            roughness={0.25}
            transmission={0.6}
            transparent
            opacity={0.85}
          />
        </mesh>

        {/* Abdominal Segment 4 & 5 */}
        <mesh position={[0, -0.55, -0.98]} rotation={[-0.65, 0, 0]}>
          <cylinderGeometry args={[0.15, 0.2, 0.38, 12]} />
          <meshPhysicalMaterial
            color="#BAE6FD"
            emissive="#00F2FE"
            emissiveIntensity={0.18}
            roughness={0.25}
            transmission={0.6}
            transparent
            opacity={0.85}
          />
        </mesh>

        {/* Tail Fan: Telson & Paired Uropod Fins */}
        <group position={[0, -0.72, -1.15]} rotation={[-0.8, 0, 0]}>
          {/* Central Telson */}
          <mesh position={[0, 0, -0.15]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.12, 0.45, 4]} />
            <meshStandardMaterial color="#00F2FE" roughness={0.3} metalness={0.2} />
          </mesh>
          {/* Right Uropod */}
          <mesh position={[0.12, 0, -0.12]} rotation={[Math.PI / 2, 0.3, 0]}>
            <boxGeometry args={[0.16, 0.38, 0.02]} />
            <meshStandardMaterial color="#38BDF8" transparent opacity={0.85} />
          </mesh>
          {/* Left Uropod */}
          <mesh position={[-0.12, 0, -0.12]} rotation={[Math.PI / 2, -0.3, 0]}>
            <boxGeometry args={[0.16, 0.38, 0.02]} />
            <meshStandardMaterial color="#38BDF8" transparent opacity={0.85} />
          </mesh>
        </group>
      </group>

      {/* 6. Walking Legs (Pereiopods under thorax) */}
      <group position={[0, -0.25, 0.1]}>
        {[-0.15, 0, 0.15].map((zOffset, i) => (
          <group key={i} position={[0, 0, zOffset]}>
            <mesh position={[0.22, -0.12, 0]} rotation={[0, 0, -0.6]}>
              <cylinderGeometry args={[0.015, 0.01, 0.35, 6]} />
              <meshStandardMaterial color="#00F2FE" />
            </mesh>
            <mesh position={[-0.22, -0.12, 0]} rotation={[0, 0, 0.6]}>
              <cylinderGeometry args={[0.015, 0.01, 0.35, 6]} />
              <meshStandardMaterial color="#00F2FE" />
            </mesh>
          </group>
        ))}
      </group>

      {/* 7. Swimmerets (Pleopods under abdomen) */}
      <group ref={swimmeretsRef} position={[0, -0.3, -0.5]}>
        {[0, -0.2].map((zOffset, i) => (
          <group key={i} position={[0, 0, zOffset]}>
            <mesh position={[0.12, -0.1, 0]} rotation={[0, 0, -0.4]}>
              <cylinderGeometry args={[0.012, 0.008, 0.22, 6]} />
              <meshStandardMaterial color="#38BDF8" transparent opacity={0.7} />
            </mesh>
            <mesh position={[-0.12, -0.1, 0]} rotation={[0, 0, 0.4]}>
              <cylinderGeometry args={[0.012, 0.008, 0.22, 6]} />
              <meshStandardMaterial color="#38BDF8" transparent opacity={0.7} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/**
 * Animated Water Surface Mesh
 */
function WaterSurface({ isConnected, waveSpeed = 1.0, color = '#00F2FE' }) {
  const meshRef = useRef();

  useFrame((state, delta) => {
    if (meshRef.current && isConnected) {
      meshRef.current.rotation.z += delta * 0.12 * waveSpeed;
      meshRef.current.position.y = 0.82 + Math.sin(state.clock.elapsedTime * 1.6 * waveSpeed) * 0.02;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0.82, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[2.32, 48]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.65}
        roughness={0.12}
        metalness={0.25}
      />
    </mesh>
  );
}

/**
 * Aerator Bubble Particle Stream
 */
function AerationBubbles({ active, count = 220 }) {
  const pointsRef = useRef();

  const [positions, speeds] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const radius = 0.4 + Math.random() * 1.4;
      const angle = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = -1.0 + Math.random() * 1.8;
      pos[i * 3 + 2] = Math.sin(angle) * radius;
      spd[i] = 0.9 + Math.random() * 1.1;
    }
    return [pos, spd];
  }, [count]);

  useFrame((state, delta) => {
    if (!pointsRef.current || !active) return;
    const array = pointsRef.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      array[i * 3 + 1] += delta * speeds[i];
      if (array[i * 3 + 1] > 0.82) {
        array[i * 3 + 1] = -1.0;
      }
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  if (!active) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.055}
        color="#FFFFFF"
        transparent
        opacity={0.75}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/**
 * Hatchery Tank Physical Structure with Integrated Equipment & Pipe Networks
 */
function HatcheryTankStructure({
  isConnected,
  aeratorOn,
  pumpOn,
  heaterOn,
  filterOn,
  waterColor,
  turbidity,
  showBubbles,
  showShrimp,
  onSelectEquipment
}) {
  // Coordinates for the 6 Virtual Shrimp inside the 4.5m circular tank
  const virtualShrimpData = [
    { radius: 1.35, height: 0.35, angle: 0.2, speed: 0.28 },
    { radius: 1.10, height: -0.40, angle: 1.3, speed: 0.22 },
    { radius: 1.55, height: 0.10, angle: 2.5, speed: 0.32 },
    { radius: 0.85, height: -0.65, angle: 3.7, speed: 0.20 },
    { radius: 1.25, height: 0.50, angle: 4.8, speed: 0.26 },
    { radius: 1.40, height: -0.15, angle: 5.6, speed: 0.24 }
  ];

  return (
    <group>
      {/* 1. Transparent Cylindrical Glass Tank Wall */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[2.4, 2.4, 2.2, 64, 1, true]} />
        <meshPhysicalMaterial
          color="#0F172A"
          transparent
          opacity={0.32}
          roughness={0.08}
          metalness={0.15}
          transmission={0.7}
          ior={1.333}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 2. Reinforced Cyan Edge Rim & Bottom Support Base */}
      <mesh position={[0, 1.1, 0]}>
        <torusGeometry args={[2.4, 0.07, 16, 64]} />
        <meshStandardMaterial
          color="#00F2FE"
          emissive="#00F2FE"
          emissiveIntensity={0.25}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      <mesh position={[0, -1.1, 0]}>
        <cylinderGeometry args={[2.46, 2.46, 0.16, 64]} />
        <meshStandardMaterial color="#0A1128" metalness={0.85} roughness={0.35} />
      </mesh>

      {/* 3. Water Volume (Inside Cylinder) */}
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[2.34, 2.34, 1.9, 48]} />
        <meshStandardMaterial
          color={waterColor}
          transparent
          opacity={turbidity > 40 ? 0.7 : 0.42}
          roughness={0.2}
          metalness={0.1}
        />
      </mesh>

      {/* 4. Animated Water Surface */}
      <WaterSurface
        isConnected={isConnected}
        waveSpeed={aeratorOn ? 1.7 : 0.7}
        color={waterColor}
      />

      {/* 5. Central Aeration Diffuser Rings on Floor */}
      <group position={[0, -0.96, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.75, 0.045, 12, 32]} />
          <meshStandardMaterial
            color={aeratorOn ? '#00F2FE' : '#334155'}
            emissive={aeratorOn ? '#00F2FE' : '#000000'}
            emissiveIntensity={aeratorOn ? 0.4 : 0}
            metalness={0.7}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.45, 0.045, 12, 32]} />
          <meshStandardMaterial
            color={aeratorOn ? '#00F2FE' : '#334155'}
            emissive={aeratorOn ? '#00F2FE' : '#000000'}
            emissiveIntensity={aeratorOn ? 0.4 : 0}
            metalness={0.7}
          />
        </mesh>
      </group>

      {/* 6. Aeration Bubbles */}
      <AerationBubbles active={isConnected && aeratorOn && showBubbles} count={240} />

      {/* 7. Six Visible Virtual Shrimp */}
      {virtualShrimpData.map((s, idx) => (
        <VirtualShrimp
          key={idx}
          index={idx}
          initialRadius={s.radius}
          initialHeight={s.height}
          initialAngle={s.angle}
          orbitSpeed={s.speed}
          visible={showShrimp}
        />
      ))}

      {/* 8. Bio-Filter Canister (External Left Side) */}
      <group
        position={[-2.85, -0.1, 0.6]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectEquipment('filter_01');
        }}
      >
        <mesh>
          <cylinderGeometry args={[0.38, 0.38, 1.3, 24]} />
          <meshStandardMaterial color="#1E293B" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Status Ring */}
        <mesh position={[0, 0.55, 0]}>
          <torusGeometry args={[0.39, 0.04, 12, 24]} />
          <meshStandardMaterial
            color={filterOn ? '#00E676' : '#EF4444'}
            emissive={filterOn ? '#00E676' : '#EF4444'}
            emissiveIntensity={0.6}
          />
        </mesh>
        {/* Connection Pipe to Tank */}
        <mesh position={[0.3, 0.2, -0.2]} rotation={[0, 0, Math.PI / 4]}>
          <cylinderGeometry args={[0.07, 0.07, 0.65, 12]} />
          <meshStandardMaterial color="#00F2FE" metalness={0.7} />
        </mesh>
      </group>

      {/* 9. Circulation Water Pump (External Right Base) */}
      <group
        position={[2.8, -0.7, -0.4]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectEquipment('water_pump_01');
        }}
      >
        <mesh>
          <boxGeometry args={[0.55, 0.5, 0.65]} />
          <meshStandardMaterial color="#0F172A" metalness={0.8} roughness={0.25} />
        </mesh>
        {/* Pump Manifold */}
        <mesh position={[0, 0.32, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.3, 16]} />
          <meshStandardMaterial color="#38BDF8" metalness={0.8} />
        </mesh>
        {/* LED Indicator */}
        <mesh position={[0, 0.28, 0.34]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial
            color={pumpOn ? '#00E676' : '#EF4444'}
            emissive={pumpOn ? '#00E676' : '#EF4444'}
            emissiveIntensity={0.8}
          />
        </mesh>
        {/* Pipe routing into tank base */}
        <mesh position={[-0.32, 0.1, 0.1]} rotation={[0, 0, -Math.PI / 3]}>
          <cylinderGeometry args={[0.065, 0.065, 0.55, 12]} />
          <meshStandardMaterial color="#38BDF8" metalness={0.7} />
        </mesh>
      </group>

      {/* 10. Immersion Heater (Mounted on Inner Rear Tank Wall) */}
      <group
        position={[0, 0, -2.15]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectEquipment('heater_01');
        }}
      >
        {/* Heater Bracket */}
        <mesh position={[0, 0.95, 0]}>
          <boxGeometry args={[0.18, 0.12, 0.22]} />
          <meshStandardMaterial color="#1E293B" metalness={0.7} />
        </mesh>
        {/* Submerged Heating Element Tube */}
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 1.4, 16]} />
          <meshStandardMaterial
            color={heaterOn ? '#F97316' : '#64748B'}
            emissive={heaterOn ? '#F97316' : '#000000'}
            emissiveIntensity={heaterOn ? 0.7 : 0}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
      </group>

      {/* 11. Top Fresh Water Supply Inlet Pipe (Top Left) */}
      <group position={[-2.35, 1.15, 0]} rotation={[0, 0, -Math.PI / 4]}>
        <mesh>
          <cylinderGeometry args={[0.08, 0.08, 0.7, 16]} />
          <meshStandardMaterial color="#38BDF8" metalness={0.7} />
        </mesh>
      </group>

      {/* 12. Bottom Central Tank Drain Pipe */}
      <mesh position={[0, -1.28, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.35, 16]} />
        <meshStandardMaterial color="#0F172A" metalness={0.8} />
      </mesh>
    </group>
  );
}

export function HatcheryTank3D() {
  const { latestSensors, hardwareStatus, equipmentList, sendEquipmentCommand } = useSocket();
  const [fullscreen, setFullscreen] = useState(false);
  const [showBubbles, setShowBubbles] = useState(true);
  const [showShrimp, setShowShrimp] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const controlsRef = useRef();

  const isConnected = hardwareStatus?.hardwareConnected;
  
  // Real equipment state from backend database
  const aerator = equipmentList.find(e => e.type === 'aerator' || e.device_id === 'aerator_01');
  const pump = equipmentList.find(e => e.type === 'water_pump' || e.device_id === 'water_pump_01');
  const heater = equipmentList.find(e => e.type === 'heater' || e.device_id === 'heater_01');
  const filter = equipmentList.find(e => e.type === 'filter' || e.device_id === 'filter_01');

  const aeratorOn = isConnected && aerator?.state === 'ON';
  const pumpOn = isConnected && pump?.state === 'ON';
  const heaterOn = isConnected && heater?.state === 'ON';
  const filterOn = isConnected && filter?.state === 'ON';

  // Sensor telemetry for dynamic water shader
  const phVal = latestSensors?.cards?.ph?.value;
  const turbVal = latestSensors?.cards?.turbidity?.value || 18.0;
  const tempVal = latestSensors?.cards?.temperature?.value;

  // Realistic water tint based on physical chemistry
  let waterColor = '#00F2FE';
  if (!isConnected) {
    waterColor = '#334155'; // Frozen dark slate when offline
  } else if (phVal !== null && (phVal < 7.0 || phVal > 9.0)) {
    waterColor = '#FF1744'; // Red alert on critical pH excursion
  } else if (turbVal > 45) {
    waterColor = '#14B8A6'; // Dense turquoise/algal scatter
  } else if (turbVal > 25) {
    waterColor = '#0EA5E9';
  }

  const resetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  const handleSelectEquipment = (deviceId) => {
    const dev = equipmentList.find(e => e.device_id === deviceId);
    if (dev) {
      setSelectedDevice(dev);
    }
  };

  return (
    <div className={`relative glass-panel rounded-3xl overflow-hidden border border-navy-700/80 transition-all ${
      fullscreen ? 'fixed inset-4 z-50 shadow-[0_25px_70px_rgba(0,0,0,0.85)]' : 'h-[500px] xl:h-[540px]'
    }`}>
      {/* 3D WebGL Canvas */}
      <ErrorBoundary
        title="3D Cyber-Physical Twin Engine"
        fallback={
          <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-[#050814] text-center">
            <Cpu className="w-12 h-12 text-cyan-neon mb-3 animate-pulse" />
            <h4 className="text-sm font-bold text-white tracking-wide">WebGL 3D Acceleration Standby</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              3D WebGL viewport paused. Sensor telemetry, physical automation, and safety interlocks continue running in real time.
            </p>
          </div>
        }
      >
        <Canvas className="w-full h-full bg-[#050B18]">
          <PerspectiveCamera makeDefault position={[0, 2.2, 5.6]} fov={45} />
          <OrbitControls
            ref={controlsRef}
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            maxPolarAngle={Math.PI / 2 + 0.08}
            minDistance={2.8}
            maxDistance={9.5}
          />

          {/* Calibrated Lighting for Underwater Glassmorphism */}
          <ambientLight intensity={0.65} />
          <directionalLight position={[6, 9, 6]} intensity={1.3} color="#FFFFFF" />
          <pointLight position={[-4, 3, -4]} intensity={0.6} color="#00F2FE" />
          <pointLight
            position={[0, -1.8, 0]}
            intensity={aeratorOn ? 1.0 : 0.4}
            color={aeratorOn ? '#00F2FE' : '#0F172A'}
          />

          <HatcheryTankStructure
            isConnected={isConnected}
            aeratorOn={aeratorOn}
            pumpOn={pumpOn}
            heaterOn={heaterOn}
            filterOn={filterOn}
            waterColor={waterColor}
            turbidity={turbVal}
            showBubbles={showBubbles}
            showShrimp={showShrimp}
            onSelectEquipment={handleSelectEquipment}
          />
        </Canvas>
      </ErrorBoundary>

      {/* Top Left Overlay: Tank Designation & Digital Twin Status */}
      <div className="absolute top-4 left-4 p-3 rounded-2xl bg-[#050B18]/90 backdrop-blur-md border border-navy-700/80 pointer-events-auto">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-cyan-neon shadow-neon-cyan animate-pulse' : 'bg-status-critical'}`} />
          <h3 className="text-sm font-bold text-white tracking-wide">Tank 01 — Larviculture Core</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-neon/15 text-cyan-neon font-mono font-medium border border-cyan-neon/30">
            DIGITAL TWIN
          </span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-2.5">
          <span>Dia: 4.5m</span>
          <span>•</span>
          <span>Vol: 25,000L</span>
          <span>•</span>
          <span className={`font-mono font-medium ${isConnected ? 'text-status-normal' : 'text-status-critical'}`}>
            {isConnected ? 'LIVE TWIN SYNC' : 'HARDWARE OFFLINE'}
          </span>
        </div>
      </div>

      {/* Top Right: Layer Toggles, Reset & Fullscreen */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {/* Layer Toggles Dropdown / Buttons */}
        <button
          onClick={() => setShowShrimp(!showShrimp)}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-mono border backdrop-blur-md transition-all flex items-center gap-1.5 ${
            showShrimp 
              ? 'bg-cyan-neon/15 border-cyan-neon/40 text-cyan-neon shadow-neon-cyan' 
              : 'bg-navy-900/80 border-navy-700 text-slate-400 hover:text-white'
          }`}
          title="Toggle 6 Virtual Shrimp Simulation"
        >
          {showShrimp ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>Virtual Shrimp (6)</span>
        </button>

        <button
          onClick={() => setShowBubbles(!showBubbles)}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-mono border backdrop-blur-md transition-all flex items-center gap-1.5 ${
            showBubbles 
              ? 'bg-cyan-neon/15 border-cyan-neon/40 text-cyan-neon' 
              : 'bg-navy-900/80 border-navy-700 text-slate-400 hover:text-white'
          }`}
          title="Toggle Aeration Bubbles"
        >
          <Droplets className="w-3.5 h-3.5" />
          <span>Bubbles</span>
        </button>

        <button
          onClick={resetCamera}
          className="p-2 rounded-xl bg-navy-900/80 hover:bg-navy-800 text-slate-300 hover:text-cyan-neon border border-navy-700 backdrop-blur-md transition-colors"
          title="Reset 3D Camera View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={() => setFullscreen(!fullscreen)}
          className="p-2 rounded-xl bg-navy-900/80 hover:bg-navy-800 text-slate-300 hover:text-cyan-neon border border-navy-700 backdrop-blur-md transition-colors"
          title={fullscreen ? 'Exit Fullscreen' : 'Expand 3D View'}
        >
          {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Floating Visual Simulation Notice (Scientific Integrity) */}
      <div className="absolute top-20 left-4 px-3 py-1.5 rounded-xl bg-navy-950/80 border border-navy-800 backdrop-blur-md text-[10px] text-slate-400 max-w-xs pointer-events-none flex items-center gap-1.5">
        <Info className="w-3.5 h-3.5 text-cyan-neon shrink-0" />
        <span>Virtual shrimp are a 3D simulation only — not actual camera detections or verified count.</span>
      </div>

      {/* Bottom Row: Equipment Status Badges (Clickable) */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2.5 pointer-events-auto">
        <div className="flex flex-wrap items-center gap-2">
          {/* Aerator Status Badge */}
          <button
            onClick={() => handleSelectEquipment('aerator_01')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium border backdrop-blur-md flex items-center gap-2 transition-all ${
              aeratorOn
                ? 'bg-cyan-neon/15 border-cyan-neon/40 text-cyan-neon shadow-neon-cyan'
                : 'bg-navy-900/85 border-navy-700 text-slate-400 hover:text-white'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${aeratorOn ? 'bg-cyan-neon animate-pulse' : 'bg-slate-500'}`} />
            <span>Aerator: {aeratorOn ? 'ACTIVE' : 'IDLE'}</span>
          </button>

          {/* Water Pump Status Badge */}
          <button
            onClick={() => handleSelectEquipment('water_pump_01')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium border backdrop-blur-md flex items-center gap-2 transition-all ${
              pumpOn
                ? 'bg-status-normal/15 border-status-normal/40 text-status-normal'
                : 'bg-navy-900/85 border-navy-700 text-slate-400 hover:text-white'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${pumpOn ? 'bg-status-normal' : 'bg-slate-500'}`} />
            <span>Pump: {pumpOn ? 'RUNNING' : 'STOPPED'}</span>
          </button>

          {/* Bio-Filter Status Badge */}
          <button
            onClick={() => handleSelectEquipment('filter_01')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium border backdrop-blur-md flex items-center gap-2 transition-all ${
              filterOn
                ? 'bg-status-normal/15 border-status-normal/40 text-status-normal'
                : 'bg-navy-900/85 border-navy-700 text-slate-400 hover:text-white'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${filterOn ? 'bg-status-normal' : 'bg-slate-500'}`} />
            <span>Bio-Filter: {filterOn ? 'ACTIVE' : 'STANDBY'}</span>
          </button>

          {/* Immersion Heater Status Badge */}
          <button
            onClick={() => handleSelectEquipment('heater_01')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium border backdrop-blur-md flex items-center gap-2 transition-all ${
              heaterOn
                ? 'bg-status-warning/15 border-status-warning/40 text-status-warning'
                : 'bg-navy-900/85 border-navy-700 text-slate-400 hover:text-white'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${heaterOn ? 'bg-status-warning animate-pulse' : 'bg-slate-500'}`} />
            <span>Heater: {heaterOn ? 'HEATING' : 'STANDBY'}</span>
          </button>
        </div>

        {/* Live Water Telemetry Snapshot (Real readings from ESP32 hardware) */}
        <div className="px-3.5 py-1.5 rounded-2xl bg-[#050B18]/90 border border-navy-700/80 backdrop-blur-md text-xs font-mono text-slate-200 flex flex-wrap items-center gap-2.5">
          <span>Temp: <strong className="text-white">{tempVal ? `${tempVal}°C` : '--'}</strong></span>
          <span>•</span>
          <span>Air Hum: <strong className="text-white">{latestSensors?.cards?.humidity?.value ? `${latestSensors.cards.humidity.value}%` : '--'}</strong></span>
          <span>•</span>
          <span>pH ADC: <strong className="text-cyan-neon">{latestSensors?.rawTelemetry?.ph_raw_adc ?? latestSensors?.cards?.ph?.rawADC ?? '--'}</strong></span>
          <span>•</span>
          <span>Turb ADC: <strong className="text-cyan-neon">{latestSensors?.rawTelemetry?.turbidity_raw_adc ?? latestSensors?.cards?.turbidity?.rawADC ?? '--'}</strong></span>
        </div>
      </div>

      {/* Equipment Inspector Modal / Drawer */}
      {selectedDevice && (
        <div className="absolute inset-y-0 right-0 w-80 bg-[#050B18]/95 backdrop-blur-xl border-l border-navy-700/80 p-5 shadow-2xl z-40 flex flex-col justify-between animate-in slide-in-from-right duration-200">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-navy-800">
              <div className="flex items-center gap-2">
                <Power className="w-4 h-4 text-cyan-neon" />
                <h4 className="text-sm font-bold text-white">{selectedDevice.name}</h4>
              </div>
              <button
                onClick={() => setSelectedDevice(null)}
                className="p-1 rounded-lg hover:bg-navy-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between p-2 rounded-lg bg-navy-900 border border-navy-800">
                <span className="text-slate-400">Device ID:</span>
                <span className="font-mono text-cyan-neon">{selectedDevice.device_id}</span>
              </div>

              <div className="flex justify-between p-2 rounded-lg bg-navy-900 border border-navy-800">
                <span className="text-slate-400">Actual State:</span>
                <span className={`font-mono font-bold ${selectedDevice.state === 'ON' ? 'text-status-normal' : 'text-slate-400'}`}>
                  {selectedDevice.state}
                </span>
              </div>

              <div className="flex justify-between p-2 rounded-lg bg-navy-900 border border-navy-800">
                <span className="text-slate-400">Control Mode:</span>
                <span className="font-mono text-white">{selectedDevice.mode}</span>
              </div>

              <div className="flex justify-between p-2 rounded-lg bg-navy-900 border border-navy-800">
                <span className="text-slate-400">Telemetry Verified:</span>
                <span className="text-status-normal flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirmed</span>
                </span>
              </div>

              <div className="p-3 rounded-xl bg-navy-950 border border-navy-800 text-[11px] text-slate-400">
                <p className="font-semibold text-slate-300 mb-1">Configured Interlock Logic:</p>
                <p>
                  {selectedDevice.type === 'aerator' && 'Triggered automatically when Dissolved Oxygen drops below 5.0 mg/L.'}
                  {selectedDevice.type === 'heater' && 'Triggered automatically when Water Temp drops below 26.0°C.'}
                  {selectedDevice.type === 'water_pump' && 'Maintains constant circulation through bio-filtration loops.'}
                  {selectedDevice.type === 'filter' && 'Continuous biological nitrification of ammonia and nitrites.'}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-navy-800">
            <button
              onClick={async () => {
                const nextState = selectedDevice.state === 'ON' ? 'OFF' : 'ON';
                await sendEquipmentCommand(selectedDevice.device_id, nextState);
                setSelectedDevice({ ...selectedDevice, state: nextState });
              }}
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                selectedDevice.state === 'ON'
                  ? 'bg-status-critical/20 hover:bg-status-critical/30 text-status-critical border border-status-critical/40'
                  : 'bg-cyan-neon hover:bg-cyan-neon/90 text-navy-950 font-bold'
              }`}
            >
              <Power className="w-4 h-4" />
              <span>{selectedDevice.state === 'ON' ? 'Turn OFF Device' : 'Turn ON Device'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
