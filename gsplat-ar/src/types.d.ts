// src/types.d.ts
declare module 'three/examples/jsm/webxr/ARButton.js' {
  import { WebGLRenderer } from 'three';
  export const ARButton: {
    createButton(renderer: WebGLRenderer, options?: any): HTMLButtonElement;
  };
}

// src/types.d.ts
declare module 'three/examples/jsm/webxr/ARButton.js' {
  import type { WebGLRenderer } from 'three';
  export const ARButton: {
    createButton(renderer: WebGLRenderer, options?: any): HTMLButtonElement;
  };
}

declare module '@mkkellogg/gaussian-splats-3d' {
  import type { Object3D, WebGLRenderer, PerspectiveCamera } from 'three';

  // 라이브러리에 있는 enum과 동일한 값으로 맞춰둠
  export enum WebXRMode {
    NONE = 0,
    AR   = 1,
    VR   = 2,
  }

  // Object3D를 상속해야 viewer.visible / position / quaternion / scale 등이 존재함
  export class DropInViewer extends Object3D {
    constructor(options: {
      renderer: WebGLRenderer;
      camera:   PerspectiveCamera;
      selfDrivenMode?: boolean;
      useBuiltInControls?: boolean;
      webXRMode?: WebXRMode;
    });
    addSplatScene(url: string): Promise<void>;
    update(dtSeconds: number): void;
  }
}

