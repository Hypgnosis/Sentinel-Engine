import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Environment, ContactShadows, PresentationControls, MeshPhysicalMaterial } from '@react-three/drei';
import * as THREE from 'three';

const FloatingCore = () => {
  const meshRef = useRef();
  const sphereRef = useRef();
  
  // Math interpolation for smooth responsiveness
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.1;
      meshRef.current.rotation.z += delta * 0.05;
    }
    
    if (sphereRef.current) {
      const t = state.clock.getElapsedTime();
      sphereRef.current.position.y = Math.sin(t * 0.5) * 0.2;
    }
  });

  return (
    <group ref={meshRef}>
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
        <mesh ref={sphereRef}>
          <octahedronGeometry args={[1, 2]} />
          <meshPhysicalMaterial 
            color="#D4B2FF"
            emissive="#D4B2FF"
            emissiveIntensity={0.5}
            roughness={0.1}
            metalness={0.9}
            clearcoat={1}
            transmission={0.5}
            thickness={0.5}
            envMapIntensity={1.5}
          />
        </mesh>
      </Float>
      
      {/* Outer Cage */}
      <mesh scale={[1.5, 1.5, 1.5]} rotation={[0, 0, 0]}>
        <torusKnotGeometry args={[1, 0.02, 128, 16]} />
        <meshPhysicalMaterial 
          color="#D4B2FF" 
          metalness={1} 
          roughness={0} 
          opacity={0.3} 
          transparent 
        />
      </mesh>
    </group>
  );
};

export const ThreeBackground = () => {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none opacity-40">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
        <PresentationControls
          global
          config={{ mass: 2, tension: 500 }}
          snap={{ mass: 4, tension: 1500 }}
          rotation={[0, 0, 0]}
          polar={[-Math.PI / 3, Math.PI / 3]}
          azimuth={[-Math.PI / 1.4, Math.PI / 1.4]}
        >
          <FloatingCore />
        </PresentationControls>
        <ContactShadows resolution={1024} scale={20} blur={2} opacity={0.25} far={10} color="#000000" />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
};
