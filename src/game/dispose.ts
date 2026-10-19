import * as THREE from 'three';

/**
 * 여러 층에서 재사용되는 캐시 자원(공유 재질·텍스처·지오메트리)에 표시를 남깁니다.
 * 표시된 자원은 disposeObject3D()가 해제하지 않으므로 다음 층에서도 안전하게 재사용됩니다.
 */
export function markShared<T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(
  resource: T
): T {
  resource.userData.isShared = true;
  return resource;
}

function isShared(resource: { userData?: Record<string, unknown> }): boolean {
  return Boolean(resource.userData && resource.userData.isShared);
}

function disposeMaterial(
  material: THREE.Material,
  disposedTextures: Set<THREE.Texture>
): void {
  if (isShared(material)) return;

  // 재질에 연결된 텍스처(map, normalMap 등 GLB 모델 텍스처 포함) 해제
  for (const value of Object.values(material)) {
    if (
      value instanceof THREE.Texture &&
      !isShared(value) &&
      !disposedTextures.has(value)
    ) {
      disposedTextures.add(value);
      value.dispose();
    }
  }
  material.dispose();
}

/**
 * 오브젝트 하위 트리의 GPU 자원(Geometry / Material / Texture)을 해제합니다.
 * - markShared()로 표시된 공유 자원은 건너뜁니다.
 * - 같은 지오메트리·재질을 여러 메쉬가 공유해도 한 번만 해제합니다.
 * 호출 전에 반드시 씬에서 오브젝트를 제거(remove)한 상태여야 합니다.
 */
export function disposeObject3D(root: THREE.Object3D): void {
  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();
  const disposedTextures = new Set<THREE.Texture>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh && !(obj as THREE.Line).isLine && !(obj as THREE.Points).isPoints) {
      return;
    }

    const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
    if (geometry && !isShared(geometry) && !disposedGeometries.has(geometry)) {
      disposedGeometries.add(geometry);
      geometry.dispose();
    }

    // InstancedMesh는 인스턴스 행렬/색상 버퍼를 별도로 보유하므로 함께 해제
    if ((obj as THREE.InstancedMesh).isInstancedMesh) {
      (obj as THREE.InstancedMesh).dispose();
    }

    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
      ? [mesh.material]
      : [];
    for (const mat of materials) {
      if (!disposedMaterials.has(mat)) {
        disposedMaterials.add(mat);
        disposeMaterial(mat, disposedTextures);
      }
    }
  });
}
