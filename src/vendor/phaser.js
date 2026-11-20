/**
 * A slimmer Phaser: the same library as `import Phaser from 'phaser'`, built from Phaser's own
 * source files, leaving out the parts this game never uses (Arcade and Matter physics, tilemaps,
 * the 3D camera and Facebook plugins, video, DOM elements, bitmap text, meshes and shaders, gamepads, and
 * the loaders for files we never load). vite.config.ts points `phaser` here, so the game's
 * imports don't change, and the type-checker still reads Phaser's own types.
 *
 * Something new from Phaser not working (say `this.add.tileSprite` is undefined)? Add its
 * module back below: the full list is node_modules/phaser/src/phaser.js and the index.js files
 * it requires. Phaser's build flags (typeof WEBGL_RENDERER and friends) are set in
 * tools/phaserFlags.ts, the way Phaser's own build sets them.
 */
import 'phaser/src/polyfills/requestVideoFrame';
import CONST from 'phaser/src/const';
import Extend from 'phaser/src/utils/object/Extend';

import Animations from 'phaser/src/animations';
import BlendModes from 'phaser/src/renderer/BlendModes';
import Cache from 'phaser/src/cache';
import Cameras from 'phaser/src/cameras';
import Core from 'phaser/src/core';
import Class from 'phaser/src/utils/Class';
import Data from 'phaser/src/data';
import Display from 'phaser/src/display';
import Events from 'phaser/src/events';
import FX from 'phaser/src/fx';
import Game from 'phaser/src/core/Game';
// Geometry and input without the parts nothing here uses (mesh geometry, gamepads).
import GeomConst from 'phaser/src/geom/const';
import Circle from 'phaser/src/geom/circle';
import GeomEllipse from 'phaser/src/geom/ellipse';
import Intersects from 'phaser/src/geom/intersects';
import GeomLine from 'phaser/src/geom/line';
import Point from 'phaser/src/geom/point';
import GeomPolygon from 'phaser/src/geom/polygon';
import GeomRectangle from 'phaser/src/geom/rectangle';
import GeomTriangle from 'phaser/src/geom/triangle';
import InputConst from 'phaser/src/input/const';
import CreatePixelPerfectHandler from 'phaser/src/input/CreatePixelPerfectHandler';
import CreateInteractiveObject from 'phaser/src/input/CreateInteractiveObject';
import InputEvents from 'phaser/src/input/events';
import InputManager from 'phaser/src/input/InputManager';
import InputPlugin from 'phaser/src/input/InputPlugin';
import InputPluginCache from 'phaser/src/input/InputPluginCache';
import Keyboard from 'phaser/src/input/keyboard';
import Mouse from 'phaser/src/input/mouse';
import Pointer from 'phaser/src/input/Pointer';
import Touch from 'phaser/src/input/touch';
import PhaserMath from 'phaser/src/math';
import Plugins from 'phaser/src/plugins';
import Renderer from 'phaser/src/renderer';
import Scale from 'phaser/src/scale';
import ScaleModes from 'phaser/src/renderer/ScaleModes';
import Scene from 'phaser/src/scene/Scene';
import Scenes from 'phaser/src/scene';
import Sound from 'phaser/src/sound';
import Structs from 'phaser/src/structs';
import Textures from 'phaser/src/textures';
import Time from 'phaser/src/time';
import Tweens from 'phaser/src/tweens';
import Utils from 'phaser/src/utils';

// The loader, with only the file types a game like this might load (it loads none today: all
// the art is drawn in code and the sounds are fetched by src/audio).
import LoaderConst from 'phaser/src/loader/const';
import LoaderEvents from 'phaser/src/loader/events';
import File from 'phaser/src/loader/File';
import FileTypesManager from 'phaser/src/loader/FileTypesManager';
import GetURL from 'phaser/src/loader/GetURL';
import LoaderPlugin from 'phaser/src/loader/LoaderPlugin';
import MergeXHRSettings from 'phaser/src/loader/MergeXHRSettings';
import MultiFile from 'phaser/src/loader/MultiFile';
import XHRLoader from 'phaser/src/loader/XHRLoader';
import XHRSettings from 'phaser/src/loader/XHRSettings';
import AtlasJSONFile from 'phaser/src/loader/filetypes/AtlasJSONFile';
import AudioFile from 'phaser/src/loader/filetypes/AudioFile';
import HTML5AudioFile from 'phaser/src/loader/filetypes/HTML5AudioFile';
import ImageFile from 'phaser/src/loader/filetypes/ImageFile';
import JSONFile from 'phaser/src/loader/filetypes/JSONFile';
import MultiAtlasFile from 'phaser/src/loader/filetypes/MultiAtlasFile';
import SpriteSheetFile from 'phaser/src/loader/filetypes/SpriteSheetFile';
import TextFile from 'phaser/src/loader/filetypes/TextFile';

// Game objects: the ones the game makes, and what Phaser itself needs.
import GOEvents from 'phaser/src/gameobjects/events';
import DisplayList from 'phaser/src/gameobjects/DisplayList';
import GameObjectCreator from 'phaser/src/gameobjects/GameObjectCreator';
import GameObjectFactory from 'phaser/src/gameobjects/GameObjectFactory';
import UpdateList from 'phaser/src/gameobjects/UpdateList';
import Components from 'phaser/src/gameobjects/components';
import GetCalcMatrix from 'phaser/src/gameobjects/GetCalcMatrix';
import BuildGameObject from 'phaser/src/gameobjects/BuildGameObject';
import BuildGameObjectAnimation from 'phaser/src/gameobjects/BuildGameObjectAnimation';
import GameObject from 'phaser/src/gameobjects/GameObject';
import Container from 'phaser/src/gameobjects/container/Container';
import Graphics from 'phaser/src/gameobjects/graphics/Graphics';
import Group from 'phaser/src/gameobjects/group/Group';
import Image from 'phaser/src/gameobjects/image/Image';
import Layer from 'phaser/src/gameobjects/layer/Layer';
import Particles from 'phaser/src/gameobjects/particles';
import RenderTexture from 'phaser/src/gameobjects/rendertexture/RenderTexture';
import Sprite from 'phaser/src/gameobjects/sprite/Sprite';
import Text from 'phaser/src/gameobjects/text/Text';
// The weather's sheets of rain (world/Ambience.ts).
import TileSprite from 'phaser/src/gameobjects/tilesprite/TileSprite';
import GetTextSize from 'phaser/src/gameobjects/text/GetTextSize';
import MeasureText from 'phaser/src/gameobjects/text/MeasureText';
import TextStyle from 'phaser/src/gameobjects/text/TextStyle';
import Zone from 'phaser/src/gameobjects/zone/Zone';
import Shape from 'phaser/src/gameobjects/shape/Shape';
import Arc from 'phaser/src/gameobjects/shape/arc/Arc';
import Ellipse from 'phaser/src/gameobjects/shape/ellipse/Ellipse';
import Line from 'phaser/src/gameobjects/shape/line/Line';
import Polygon from 'phaser/src/gameobjects/shape/polygon/Polygon';
import Rectangle from 'phaser/src/gameobjects/shape/rectangle/Rectangle';
import Triangle from 'phaser/src/gameobjects/shape/triangle/Triangle';
import Light from 'phaser/src/gameobjects/lights/Light';
import LightsManager from 'phaser/src/gameobjects/lights/LightsManager';
// Every scene gets the lights plugin (Phaser's DefaultPlugins), so it stays.
import LightsPlugin from 'phaser/src/gameobjects/lights/LightsPlugin';
// Factories and creators register this.add.<thing> and this.make.<thing> as they load (they export nothing).
import 'phaser/src/gameobjects/container/ContainerFactory';
import 'phaser/src/gameobjects/graphics/GraphicsFactory';
import 'phaser/src/gameobjects/group/GroupFactory';
import 'phaser/src/gameobjects/image/ImageFactory';
import 'phaser/src/gameobjects/layer/LayerFactory';
import 'phaser/src/gameobjects/particles/ParticleEmitterFactory';
import 'phaser/src/gameobjects/rendertexture/RenderTextureFactory';
import 'phaser/src/gameobjects/sprite/SpriteFactory';
import 'phaser/src/gameobjects/text/TextFactory';
import 'phaser/src/gameobjects/tilesprite/TileSpriteFactory';
import 'phaser/src/gameobjects/zone/ZoneFactory';
import 'phaser/src/gameobjects/shape/arc/ArcFactory';
import 'phaser/src/gameobjects/shape/ellipse/EllipseFactory';
import 'phaser/src/gameobjects/shape/line/LineFactory';
import 'phaser/src/gameobjects/shape/polygon/PolygonFactory';
import 'phaser/src/gameobjects/shape/rectangle/RectangleFactory';
import 'phaser/src/gameobjects/shape/triangle/TriangleFactory';
import 'phaser/src/gameobjects/container/ContainerCreator';
import 'phaser/src/gameobjects/graphics/GraphicsCreator';
import 'phaser/src/gameobjects/group/GroupCreator';
import 'phaser/src/gameobjects/image/ImageCreator';
import 'phaser/src/gameobjects/layer/LayerCreator';
import 'phaser/src/gameobjects/particles/ParticleEmitterCreator';
import 'phaser/src/gameobjects/rendertexture/RenderTextureCreator';
import 'phaser/src/gameobjects/sprite/SpriteCreator';
import 'phaser/src/gameobjects/text/TextCreator';
import 'phaser/src/gameobjects/tilesprite/TileSpriteCreator';
import 'phaser/src/gameobjects/zone/ZoneCreator';

const Geom = Extend(false, {
  Circle,
  Ellipse: GeomEllipse,
  Intersects,
  Line: GeomLine,
  Point,
  Polygon: GeomPolygon,
  Rectangle: GeomRectangle,
  Triangle: GeomTriangle,
}, GeomConst);

const Input = Extend(false, {
  CreatePixelPerfectHandler,
  CreateInteractiveObject,
  Events: InputEvents,
  InputManager,
  InputPlugin,
  InputPluginCache,
  Keyboard,
  Mouse,
  Pointer,
  Touch,
}, InputConst);

const Loader = Extend(false, {
  Events: LoaderEvents,
  FileTypes: { AtlasJSONFile, AudioFile, HTML5AudioFile, ImageFile, JSONFile, MultiAtlasFile, SpriteSheetFile, TextFile },
  File,
  FileTypesManager,
  GetURL,
  LoaderPlugin,
  MergeXHRSettings,
  MultiFile,
  XHRLoader,
  XHRSettings,
}, LoaderConst);

const GameObjects = {
  Events: GOEvents,
  DisplayList,
  GameObjectCreator,
  GameObjectFactory,
  UpdateList,
  Components,
  GetCalcMatrix,
  BuildGameObject,
  BuildGameObjectAnimation,
  GameObject,
  Container,
  Graphics,
  Group,
  Image,
  Layer,
  Particles,
  RenderTexture,
  Sprite,
  Text,
  GetTextSize,
  MeasureText,
  TextStyle,
  TileSprite,
  Zone,
  Shape,
  Arc,
  Ellipse,
  Line,
  Polygon,
  Rectangle,
  Triangle,
  Light,
  LightsManager,
  LightsPlugin,
  // Phaser's own GameObjects.Factories and .Creators hold nothing useful (the modules export nothing).
  Factories: {},
  Creators: {},
};

const Phaser = Extend(false, {
  Animations,
  BlendModes,
  Cache,
  Cameras,
  Core,
  Class,
  Data,
  Display,
  Events,
  FX,
  Game,
  GameObjects,
  Geom,
  Input,
  Loader,
  Math: PhaserMath,
  Plugins,
  Renderer,
  Scale,
  ScaleModes,
  Scene,
  Scenes,
  Sound,
  Structs,
  Textures,
  Time,
  Tweens,
  Utils,
}, CONST);

export default Phaser;
