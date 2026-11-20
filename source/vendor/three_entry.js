import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Sprite, SpriteMaterial, Object3D, InstancedMesh,
  BoxGeometry, PlaneGeometry, CylinderGeometry, SphereGeometry, CircleGeometry, ConeGeometry,
  TorusGeometry, LatheGeometry, ExtrudeGeometry, Shape, CapsuleGeometry, RingGeometry, IcosahedronGeometry,
  MeshStandardMaterial, MeshBasicMaterial, MeshLambertMaterial,
  AmbientLight, DirectionalLight, HemisphereLight, PointLight,
  Texture, CanvasTexture, Color, Vector2, Vector3, Euler, Quaternion, Matrix4, Fog,
  SRGBColorSpace, RepeatWrapping, MirroredRepeatWrapping, DoubleSide, BackSide, FrontSide, PCFSoftShadowMap, ACESFilmicToneMapping, NoToneMapping,
  Points, BufferGeometry, BufferAttribute, Float32BufferAttribute, PointsMaterial, AdditiveBlending,
  PMREMGenerator, Raycaster, MathUtils
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
window.THREE = {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Sprite, SpriteMaterial, Object3D, InstancedMesh,
  BoxGeometry, PlaneGeometry, CylinderGeometry, SphereGeometry, CircleGeometry, ConeGeometry,
  TorusGeometry, LatheGeometry, ExtrudeGeometry, Shape, CapsuleGeometry, RingGeometry, IcosahedronGeometry,
  MeshStandardMaterial, MeshBasicMaterial, MeshLambertMaterial,
  AmbientLight, DirectionalLight, HemisphereLight, PointLight,
  Texture, CanvasTexture, Color, Vector2, Vector3, Euler, Quaternion, Matrix4, Fog,
  SRGBColorSpace, RepeatWrapping, MirroredRepeatWrapping, DoubleSide, BackSide, FrontSide, PCFSoftShadowMap, ACESFilmicToneMapping, NoToneMapping,
  Points, BufferGeometry, BufferAttribute, Float32BufferAttribute, PointsMaterial, AdditiveBlending,
  PMREMGenerator, Raycaster, MathUtils,
  RoomEnvironment, RoundedBoxGeometry, mergeGeometries
};
