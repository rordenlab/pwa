import{n as e,r as t,t as n}from"./index-1UjF2ShS.js";var r=t(e(),1),i=`import { vec2, vec3, vec4 } from 'gl-matrix';
import { LivewireSlice } from './annotation/livewireSlice';
import { AnnotationUndoStack } from './annotation/undoRedo';
import { ExplodedBlockPick } from './control/interactions';
import { AddMeasurementOptions } from './control/measurements';
import { ReinitializeOptions, ViewLifecycle } from './control/viewLifecycle';
import { SettingsFillPolicy, SettingsSavePolicy } from './documentSettings';
import { NVExtensionContext } from './extension/context';
import { LogLevel } from './logger';
import { WriteOptions } from './mesh/writers';
import { OVERLAY_ALPHA_BLEND, OVERLAY_COLOR_BLEND, PEN_SHAPE } from './NVConstants';
import { ChunkStreamCounts, ChunkStreamDetail, GraphRangeChangeDetail, NVEventListener, NVEventMap } from './NVEvents';
import { default as NVModel } from './NVModel';
import { AffineMatrix, AffineTransform, AnimationOptions, AnimationResult, AnimationTarget, AnnotationPoint, AnnotationScreenShape, AnnotationStyle, AnnotationTool, BackendType, CanvasViewport, ColorMap, CompletedMeasurement, CustomLayoutTile, FocusBox, ImageFromUrlOptions, LodCompensationReport, LUT, MeasurementScreenLine, MeshFromUrlOptions, MeshLayerFromUrlOptions, MeshUpdate, NiiVueOptions, NVBounds, NVConnectomeOptions, NVFontData, NVGlobalCamera, NVImage, NVInstance, NVMeshLayer, NVMesh as NVMeshType, NVSignalDisplay, NVSignal as NVSignalType, NVTractOptions, SaveVolumeOptions, SignalAnnotation, SyncOpts, VectorAnnotation, ViewHitTest, VolumeChunkExplode, VolumeUpdate, WheelZoomAnchor } from './NVTypes';
import { SignalFromUrlOptions } from './signal/NVSignal';
import { NVSlide } from './slide/NVSlide';
import { SlidePlaneState } from './slide/slidePlane';
import { SlideVectorLayer } from './slide/slideVector';
import { GraphLayout } from './view/NVGraph';
import { LegendLayout } from './view/NVLegend';
import { UIKitOverlayFrame, UIKitOverlayRenderer } from './view/NVOverlayHook';
import { CanvasTilePoint, SliceTile } from './view/NVSliceLayout';
import { UpdateBindGroupsOptions } from './view/volumeUpdateScope';
import { ExplodedBlockFace } from './volume/ChunkExplode';
import { ChunkedVolumeSource } from './volume/ChunkedVolumeSource';
import { ChunkPlan, Vec3i } from './volume/chunking';
import { ChunkTimingSnapshot } from './volume/chunkTiming';
import { DescriptiveStats } from './volume/descriptives';
import { ChunkedVolumeOptions, NVChunkedVolume } from './volume/NVChunkedVolume';
import { TransformInfo, TransformOptions, VolumeTransform } from './volume/transforms';
import * as NVDocument from './NVDocument';
type ViewBackend = {
    init: () => Promise<void>;
    resize: () => void;
    render: () => void;
    updateBindGroups: (opts?: UpdateBindGroupsOptions) => Promise<void>;
    updateMeshVertices: (mesh: NVMeshType) => boolean;
    updateAffineOverlays?: () => Promise<boolean>;
    setCoarseFloor?: (coarseVol: NVImage | null) => Promise<void>;
    swapChunkedVolumePlan?: (vol: NVImage, plan: ChunkPlan) => Promise<void>;
    hitTest: (x: number, y: number) => ViewHitTest | null;
    depthPick: (x: number, y: number) => Promise<[number, number, number] | null>;
    loadThumbnail: (url: string) => Promise<void>;
    screenSlices: SliceTile[];
    legendLayout: LegendLayout | null;
    graphLayout: GraphLayout | null;
    getAvailableShaders: () => string[];
    slidePlane: SlidePlaneState | null;
    refreshDrawing: (rgba: Uint8Array, dims: number[], plan?: ChunkPlan, dirtyChunks?: readonly number[]) => void;
    clearDrawing: () => void;
    destroy: () => void;
    forceDevicePixelRatio: number;
    chunkStreamStats: () => ChunkStreamDetail;
    rebakeChunkedOverlays: () => void;
    /**
     * Voxel dims of the whole-volume coarse floor texture, or null when none is
     * installed. Renderer-owned state (the floor is not a member of
     * \`plan.chunks\`), surfaced so \`lodCompensation()\` can report it.
     */
    coarseFloorDims: () => [number, number, number] | null;
    overlayDraw: ((frame: UIKitOverlayFrame) => void) | null;
    onContextLost: (() => void) | null;
    onChunkStream: ((counts: ChunkStreamCounts, settled: boolean, snapshot: () => ChunkStreamDetail) => void) | null;
};
export type { NiiVueOptions };
export type DistributionBackend = 'both' | 'webgpu' | 'webgl2';
/** Slide drawing tools (see \`slideTool\`). */
export type SlideDrawTool = 'pen' | 'eraser' | 'bucket' | 'filled' | 'wand' | 'vector';
type InfrastructureOpts = {
    backend?: BackendType;
    isAntiAlias?: boolean;
    isDragDropEnabled?: boolean;
    isInteractionEnabled?: boolean;
    instances?: NVInstance[];
    globalCamera?: NVGlobalCamera;
    forceDevicePixelRatio?: number;
    logLevel?: LogLevel;
    thumbnail?: string;
    font?: NVFontData;
    matcaps?: Record<string, string>;
    bounds?: NVBounds;
    showBoundsBorder?: boolean;
    boundsBorderColor?: [number, number, number, number];
    boundsBorderThickness?: number;
    maxTextureDimension3D?: number;
    maxChunkResidencyBytes?: number;
    chunkFadeMs?: number;
};
type EventHandler = ((e: Event) => void) | ((e: Event) => Promise<void>);
/**
 * Public render-perf API surface accessed via \`nv.perf\`. Setting
 * \`enabled = true\` arms \`performance.mark\`/\`measure\` instrumentation
 * in the renderer and starts emitting a \`perfFrame\` event on the
 * controller after every render. Tag the next frame with
 * \`tagFrame('myAction')\` before mutating state so the frame report
 * carries an action source.
 */
declare class NiiVuePerf {
    private readonly _controller;
    private _frameUnsub;
    constructor(_controller: NiiVue);
    get enabled(): boolean;
    set enabled(value: boolean);
    /**
     * Tag the next frame with an action source. Cleared after the next
     * \`render()\`, so each call applies to exactly one frame. No-op when
     * \`enabled\` is false.
     */
    tagFrame(tag: string): void;
}
export default class NiiVue extends EventTarget {
    activeClipPlaneIndex: number;
    currentClipPlaneIndex: number;
    canvas: HTMLCanvasElement | null;
    opts: InfrastructureOpts;
    private _isDraggingFlag;
    /**
     * True during an active pointer drag. Mirrored to \`model._isDragging\` so the
     * view can pause expensive per-frame work (e.g. the chunked-volume upload
     * pump) during interaction and keep rotation/pan smooth.
     */
    get isDragging(): boolean;
    set isDragging(value: boolean);
    lastPointerX: number;
    lastPointerY: number;
    framePending: boolean;
    activeTileHit: ViewHitTest | null;
    activeButton?: number;
    model: NVModel;
    view: ViewBackend | null;
    /** Privileged UIKit overlay renderers, drawn at the end of every frame. */
    private _overlayRenderers;
    /** Busy/idle transition tracking behind \`chunkStreamProgress\`/\`chunkStreamIdle\`. */
    private _chunkStreamEmitter;
    /** The view instance \`_onChunkStream\` was last wired onto. When
     *  \`_wireViewHooks\` sees a different instance (attach, or a recreate after a
     *  backend switch or context loss), the emitter is reset first so the old
     *  view's busy episode cannot leak a spurious idle into — or swallow the
     *  first progress of — the new view. */
    private _chunkStreamWiredView;
    /** View hook: both backends call this once per drawn frame (see
     *  \`ChunkStreamEmitter\`). Bound so \`_wireViewHooks\` can re-point it at a
     *  recreated view, like \`overlayDraw\` and \`onContextLost\`. */
    private _onChunkStream;
    /** \`whenChunkStreamSettles\` waiters, each fed the settled verdict of every
     *  frame drawn after it registered. Called with \`true\` on teardown, since
     *  no frame will follow. */
    private _chunkFrameWaiters;
    private _settingsSavePolicy;
    private _settingsFillPolicy;
    private _slidePlane;
    private _slidePlaneSlide;
    private _slidePlaneOnChange;
    private _slideDrawing;
    private _slideVector;
    private _slideLastRasterPt;
    private _slideTool;
    private _slideWandTolerance;
    private _slideFillPts;
    private _slideVecPts;
    resizeObserver: ResizeObserver | null;
    _dprMediaQuery: {
        mql: MediaQueryList;
        handler: (event: MediaQueryListEvent) => void;
    } | null;
    _eventListeners: Record<string, EventHandler | null>;
    private _updating;
    /** Identifies the current holder of \`_updating\` (see \`_beginUpdate\`). */
    private _updateToken;
    /** The view the current lock holder is rebuilding. */
    private _updatingView;
    /** Resolves when the update holding \`_updating\` releases it. */
    private _updateIdle;
    private _resolveUpdateIdle;
    private _pendingUpdate;
    /** A full (not affine-only) update is queued behind \`_updating\`. */
    private _pendingFull;
    /** The mesh rebuild covering every update queued behind \`_updating\`. */
    private _pendingMeshes;
    /** Whether any update queued behind \`_updating\` needs every volume rebuilt. */
    private _pendingAllVolumes;
    /** Volumes whose data changed, for queued scoped (updateVolumeData) updates. */
    private _pendingVolumes;
    /** Whether any update queued behind \`_updating\` needs the colorbars rebuilt. */
    private _pendingColorbars;
    /** Volume ids with an in-flight deferred 4D reload (guards rapid ellipsis clicks
     *  from launching duplicate multi-GB re-fetches and racing rollbacks). */
    private _deferredReloads;
    /** Set once \`destroy()\` runs, so an in-flight async op (e.g. a deferred reload)
     *  can detect a torn-down controller and not mutate/upload against it. */
    private _destroyed;
    private _contextLossRecoveries;
    /** Live streamed-volume handles, so a setting that changes the required brick
     *  halo (currently only \`volumeIsCubicInterpolation\`) can re-plan them. Each
     *  handle adds itself on construction and removes itself on \`dispose()\`. */
    private _chunkedVolumes;
    /** @internal Registration hook for {@link NVChunkedVolume}. */
    _registerChunkedVolume(chunked: NVChunkedVolume): void;
    /** @internal Deregistration hook for {@link NVChunkedVolume}. */
    _unregisterChunkedVolume(chunked: NVChunkedVolume): void;
    /**
     * True once {@link destroy} has run. Lets external holders (e.g. an
     * NVChunkedVolume handle listening for \`viewDestroyed\`) distinguish a real
     * controller teardown from a transient view recreation (backend switch /
     * init fallback), which also emits \`viewDestroyed\` but leaves the controller
     * and its volumes alive.
     */
    get isDestroyed(): boolean;
    private _deferredVolumes;
    private _deferredMeshes;
    private _viewLifecycle;
    private _distributionBackend;
    _drawPenLocation: number[];
    _drawPenAxCorSag: number;
    _drawPenFillPts: number[][];
    _draw3DActive: boolean;
    _draw3DLastVoxel: [number, number, number] | null;
    _draw3DLastChunk: number | null;
    _draw3DNeedsUndo: boolean;
    _draw3DSampleCache: {
        vol: NVImage;
        data: Float32Array;
    } | null;
    _drawLut: LUT | null;
    _drawingDirty: boolean;
    _drawDirtyBox: {
        min: [number, number, number];
        max: [number, number, number];
    } | null;
    drawPenAutoClose: boolean;
    drawPenFilled: boolean;
    drawUndoBitmaps: Uint8Array[];
    currentDrawUndoBitmap: number;
    maxDrawUndoBitmaps: number;
    dragStartXY: [number, number];
    dragEndXY: [number, number];
    _activeDragMode: number;
    _angleState: 'none' | 'drawing_first_line' | 'drawing_second_line';
    _angleFirstLine: number[];
    _pan2DxyzmmAtDragStart: [number, number, number, number] | null;
    /** True once a \`crosshairPan\` gesture has crossed the drag threshold. */
    _crosshairPanDidDrag: boolean;
    _annotationUndoStack: AnnotationUndoStack;
    _annotationBrushPath: AnnotationPoint[];
    _frozenLoopPoints: AnnotationPoint[] | null;
    _annotationSliceType: number;
    _annotationSlicePosition: number;
    _annotationAnchorMM: [number, number, number];
    _annotation3DActive: boolean;
    _annotation3DMMPath: [number, number, number][];
    _annotation3DFace: ExplodedBlockFace | null;
    _annotationShapeStart: AnnotationPoint | null;
    _annotationPolyPoints: AnnotationPoint[] | null;
    _annotationPolySliceType: number;
    _annotationPolySlicePosition: number;
    _annotationPolyAnchorMM: [number, number, number];
    _livewireSlice: LivewireSlice | null;
    _livewireField: Int32Array | null;
    _livewireSeed: {
        x: number;
        y: number;
    } | null;
    _pointerClient: [number, number] | null;
    _bidirectionalLong: {
        start: AnnotationPoint;
        end: AnnotationPoint;
    } | null;
    _resizingControlPoint: number;
    _resizeOriginalShape: {
        start: AnnotationPoint;
        end: AnnotationPoint;
        width?: number;
    } | null;
    _resizingAnnotation: VectorAnnotation | null;
    private _syncTargets;
    private _syncOpts;
    private _syncDirty;
    private _rafId;
    private _animation;
    private _perf;
    constructor(options: NiiVueOptions | undefined, viewLifecycle: ViewLifecycle, distributionBackend?: DistributionBackend);
    addEventListener<K extends keyof NVEventMap>(type: K, listener: NVEventListener<K>, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof NVEventMap>(type: K, listener: NVEventListener<K>, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
    /** Emit a typed event. Uses CustomEvent with detail for events that carry data. */
    emit<K extends keyof NVEventMap>(type: K, ...args: NVEventMap[K] extends undefined ? [] : [detail: NVEventMap[K]]): void;
    /**
     * Render-perf API. Set \`nv.perf.enabled = true\` to start receiving
     * \`perfFrame\` events with \`{ tag, cpuMs, submitMs, totalMs, phases }\`
     * after every render. Use \`nv.perf.tagFrame('myAction')\` before
     * mutating state to label the resulting frame.
     */
    get perf(): NiiVuePerf;
    get azimuth(): number;
    set azimuth(v: number);
    get elevation(): number;
    set elevation(v: number);
    get crosshairPos(): vec3;
    set crosshairPos(v: vec3);
    /**
     * Resolve a pointer position over the 3D render onto one exploded brick of a
     * chunked volume, or null when the point misses every visible brick.
     *
     * Pass \`event.clientX\` / \`event.clientY\` from a click handler: the hit test
     * runs here, so no drag needs to be in progress. Pair with
     * \`extractChunkBlock(vol, pick.chunkIndex)\` to copy the picked brick out as a
     * standalone volume, and with \`focusBox\` (using \`explodedMin\`/\`explodedMax\`) to
     * outline it in place.
     */
    pickExplodedBlock(clientX: number, clientY: number): ExplodedBlockPick | null;
    /**
     * Transient world-space box outlined as 12 edges on the 3D render view (e.g. a
     * focused subvolume). \`min\`/\`max\` are in the scene's world-mm space. Set null
     * to clear. Not serialized.
     */
    get focusBox(): FocusBox | null;
    set focusBox(box: FocusBox | null);
    /** Set of world-space boxes drawn on 3D render tiles (e.g. per-brick LOD). */
    get lodBoxes(): FocusBox[] | null;
    set lodBoxes(boxes: FocusBox[] | null);
    get pan2Dxyzmm(): vec4;
    set pan2Dxyzmm(v: vec4);
    get scaleMultiplier(): number;
    set scaleMultiplier(v: number);
    get renderPan(): vec2;
    set renderPan(v: vec2);
    /**
     * World-mm pivot the 3D render orbits/zooms about. Null = volume centre. Set
     * to the crosshair to keep a focused point framed through rotation and zoom
     * (an alternative to the renderPan-offset centring).
     */
    get renderPivotMM(): vec3 | null;
    set renderPivotMM(v: vec3 | null);
    /**
     * Project a world-mm point to the 3D render tile's NDC ([-1,1], y up), using
     * the MVP the renderer cached on its last draw (so it reflects the current
     * camera, zoom, and renderPan exactly). Returns null if no render tile has been
     * drawn yet or the point is at/behind the camera.
     */
    mm2renderNDC(mm: [number, number, number]): [number, number] | null;
    /**
     * Pan the 3D render so a given world-mm point sits at the centre of the render
     * tile, by adjusting \`renderPan\` (a clip-space translation; no change to the
     * camera, rotation, or zoom). Useful to keep a zoomed/focused region framed.
     * Returns false (no-op) if the render tile hasn't been drawn yet. Because the
     * cached MVP already includes the current renderPan, this converges in one
     * call: newPan = currentPan - ndc(point).
     */
    centerRenderOnMM(mm: [number, number, number]): boolean;
    /**
     * Convert a pointer event's client position to the canvas pixel space that
     * {@link hitTest}, {@link canvasToMM}, {@link mmToCanvas} and
     * {@link getScreenTiles} use. This is the exact conversion the built-in
     * pointer handlers apply, so a caller never has to reproduce it:
     * \`(client - canvas rect origin) * dpr\`, where \`dpr\` is
     * \`window.devicePixelRatio\` or \`forceDevicePixelRatio\` when that is set > 0;
     * then, for an instance sharing a canvas via \`bounds\`, minus the origin of
     * this instance's post-viewport pixel rect.
     *
     * Returns null when the instance has no canvas or, for a \`bounds\` instance,
     * when the point is outside this instance's rect (a sibling's area) or the
     * rect is offscreen.
     */
    clientToCanvas(clientX: number, clientY: number): [number, number] | null;
    /**
     * Hit-test a canvas position against the current frame's tiles.
     *
     * Coordinate convention (shared by {@link canvasToMM}, {@link mmToCanvas}
     * and {@link getScreenTiles}): canvas BACKING-STORE pixels — the
     * \`canvas.width\`/\`canvas.height\` space the renderer draws into — origin at
     * the top-left, y down. These are NOT CSS pixels, and for an instance
     * sharing one canvas via \`bounds\` they are bounds-local (the instance's own
     * pixel rect subtracted). Use {@link clientToCanvas} to convert a pointer
     * event; it applies the devicePixelRatio / \`forceDevicePixelRatio\` rule and
     * the bounds offset exactly as the built-in pointer handlers do.
     *
     * Returns the tile index, its slice type, whether it is a 3D render tile,
     * and the position normalized to the tile rect (half-open [0,1), y down);
     * null when no
     * tile contains the point or the view is not initialized.
     */
    hitTest(canvasX: number, canvasY: number): ViewHitTest | null;
    /**
     * Convert a canvas position to a world-mm point by picking on the 2D slice
     * tile under it (ray/slice-plane intersection — the same math the built-in
     * crosshair click uses, so the result matches \`setCrosshairPos\` picking).
     *
     * Input is canvas backing-store pixels — see {@link hitTest} for the exact
     * convention and the CSS-pixel/devicePixelRatio conversion.
     *
     * Returns null when the point misses every tile, lands on a 3D render tile,
     * or no volume is loaded.
     */
    canvasToMM(canvasX: number, canvasY: number): [number, number, number] | null;
    /**
     * Project a world-mm point to canvas pixels on the best-matching 2D slice
     * tile, using the MVP each tile cached on its last draw (so the result
     * reflects the current pan/zoom exactly). Intended for positioning external
     * overlays (SVG/HTML crosshairs, labels) over slices.
     *
     * Tile selection: the 2D slice tile whose slice plane passes nearest the
     * point (perpendicular distance in mm); ties — e.g. the crosshair, which
     * lies on every plane of a multiplanar layout — resolve to the lowest tile
     * index. 3D render tiles are never selected (use {@link mm2renderNDC} for
     * those).
     *
     * The returned x/y are canvas backing-store pixels (see {@link hitTest});
     * divide by the effective devicePixelRatio to position CSS-pixel-sized
     * overlay elements. The point may project outside the winning tile's rect
     * when panned/zoomed out of view — clip against the tile's
     * \`leftTopWidthHeight\` if needed. Returns null before the first render or
     * when the layout has no 2D slice tiles.
     */
    mmToCanvas(mm: [number, number, number]): CanvasTilePoint | null;
    /**
     * Snapshot of the current frame's tiles for external overlay renderers: each
     * tile's rect (\`leftTopWidthHeight\`, canvas backing-store pixels — see
     * {@link hitTest}), orientation (\`axCorSag\`; \`SLICE_TYPE.RENDER\` marks the
     * 3D tile) and, for 2D slice tiles after their first draw, the cached
     * projection geometry (\`mvpMatrix\`, \`planeNormal\`, \`planePoint\`) used by
     * {@link mmToCanvas}/{@link canvasToMM}.
     *
     * Each entry is a deep copy (every nested field, including \`screen\`,
     * \`crossLines\` and the geometry arrays), so the snapshot stays coherent
     * while the renderer keeps drawing, and mutating it cannot reach renderer
     * state. Recompute per frame if you track a live view; the snapshot does
     * not update.
     */
    getScreenTiles(): readonly SliceTile[];
    /**
     * Display gamma for the 3D volume render. Applied to each sample's classified
     * RGB, never to its alpha, so brightening the image does not change how much
     * a ray occludes. Values above 1 brighten, below 1 darken; 1 (the default) is
     * a strict no-op. Clamped to GAMMA_RANGE.
     */
    get gamma(): number;
    set gamma(v: number);
    get backgroundColor(): [number, number, number, number];
    set backgroundColor(v: [number, number, number, number]);
    get clipPlaneColor(): number[];
    set clipPlaneColor(v: number[]);
    get isClipPlaneCutaway(): boolean;
    set isClipPlaneCutaway(v: boolean);
    get clipPlaneOverlay(): boolean;
    set clipPlaneOverlay(v: boolean);
    get sliceType(): number;
    set sliceType(v: number);
    get mosaicString(): string;
    set mosaicString(v: string);
    get showRender(): number;
    set showRender(v: number);
    get multiplanarType(): number;
    set multiplanarType(v: number);
    get heroFraction(): number;
    set heroFraction(v: number);
    get heroSliceType(): number;
    set heroSliceType(v: number);
    get isEqualSize(): boolean;
    set isEqualSize(v: boolean);
    get isMosaicCentered(): boolean;
    set isMosaicCentered(v: boolean);
    get tileMargin(): number;
    set tileMargin(v: number);
    /**
     * Control whether 2D slices use radiological or neurological convention.
     * @default \`false\` (neurological)
     * @example nv1.isRadiological = true
     * @see {@link https://niivue.github.io/mono/examples/freesurfer.clip.html | live demo usage}
     */
    get isRadiological(): boolean;
    set isRadiological(v: boolean);
    /**
     * Let a single 2D slice (axial, coronal or sagittal alone) use the whole
     * canvas rather than a tile letterboxed to the slice's aspect ratio. The
     * slice draws at the same scale and position either way; filling only means a
     * zoomed view spends the margins on image instead of clipping them away.
     * @default \`true\`
     * @example nv1.isSingleViewFillCanvas = false
     */
    get isSingleViewFillCanvas(): boolean;
    set isSingleViewFillCanvas(v: boolean);
    /**
     * Get or set a custom tile layout. When set to a non-empty array this
     * overrides all built-in layout modes (multiplanar, mosaic, hero).
     * Each tile specifies a slice type and a normalized [left, top, width, height]
     * position within the canvas (0–1).
     *
     * Set to \`null\` to revert to built-in layouts.
     *
     * @example
     * // Left half: sagittal, top-right: coronal, bottom-right: axial
     * nv.customLayout = [
     *   { sliceType: 2, position: [0, 0, 0.5, 1.0] },
     *   { sliceType: 1, position: [0.5, 0, 0.5, 0.5] },
     *   { sliceType: 0, position: [0.5, 0.5, 0.5, 0.5] },
     * ];
     */
    get customLayout(): CustomLayoutTile[] | null;
    set customLayout(v: CustomLayoutTile[] | null);
    /** Clear any custom layout and revert to built-in layout modes. */
    clearCustomLayout(): void;
    get isColorbarVisible(): boolean;
    set isColorbarVisible(v: boolean);
    /**
     * Control whether the orientation cube is shown on the 3D render view.
     * Each face of the cube is labeled with an anatomical direction: Anterior (A), Posterior (P), Left (L), Right (R), Superior (S), Inferior (I).
     * @default \`true\`
     * @example nv1.isOrientCubeVisible = false
     * @see {@link https://niivue.github.io/mono/examples/vox.basic.html | live demo usage}
     */
    get isOrientCubeVisible(): boolean;
    set isOrientCubeVisible(v: boolean);
    get isOrientationTextVisible(): boolean;
    set isOrientationTextVisible(v: boolean);
    get is3DCrosshairVisible(): boolean;
    set is3DCrosshairVisible(v: boolean);
    get isGraphVisible(): boolean;
    set isGraphVisible(v: boolean);
    get isRulerVisible(): boolean;
    set isRulerVisible(v: boolean);
    get isCrossLinesVisible(): boolean;
    set isCrossLinesVisible(v: boolean);
    get isLegendVisible(): boolean;
    set isLegendVisible(v: boolean);
    get isMeasureUnitsVisible(): boolean;
    set isMeasureUnitsVisible(v: boolean);
    get isMeasurementDrawn(): boolean;
    set isMeasurementDrawn(v: boolean);
    /**
     * When false, NiiVue's built-in 2D vector-annotation shapes are not drawn, so
     * an external overlay can render them from \`annotationScreenShapes\`. The brush
     * cursor and selection handles are unaffected.
     */
    get isAnnotationDrawn(): boolean;
    set isAnnotationDrawn(v: boolean);
    get isThumbnailVisible(): boolean;
    set isThumbnailVisible(v: boolean);
    get thumbnailUrl(): string;
    set thumbnailUrl(v: string);
    get placeholderText(): string;
    set placeholderText(v: string);
    get crosshairColor(): number[];
    set crosshairColor(v: number[]);
    get crosshairColorPerAxis(): number[][];
    /**
     * Per-axis crosshair colors as \`[xColor, yColor, zColor]\` (each RGBA, 0..1).
     * Set to 3 colors to tint each crosshair segment by the world axis it extends
     * along (X = left-right, Y = anterior-posterior, Z = superior-inferior).
     * Set to \`[]\` to fall back to the single {@link crosshairColor} for all axes.
     */
    set crosshairColorPerAxis(v: number[][]);
    get crosshairGap(): number;
    set crosshairGap(v: number);
    get crosshairWidth(): number;
    set crosshairWidth(v: number);
    get fontColor(): number[];
    set fontColor(v: number[]);
    get fontScale(): number;
    set fontScale(v: number);
    get fontMinSize(): number;
    set fontMinSize(v: number);
    get selectionBoxColor(): number[];
    set selectionBoxColor(v: number[]);
    get measureLineColor(): number[];
    set measureLineColor(v: number[]);
    get measureTextColor(): number[];
    set measureTextColor(v: number[]);
    /**
     * Every visible measurement projected to the current frame's canvas pixels
     * (all persisted measurements plus an in-progress drag). Populated during
     * render; read it from a registered overlay renderer (see
     * {@link registerOverlayRenderer}) to draw measurements with an external
     * renderer — e.g. a @niivue/uikit ruler with rotated tick numbers — instead of
     * the built-in line. Hide the built-in draw by setting \`measureLineColor\` /
     * \`measureTextColor\` alpha to 0. Each persisted entry carries an \`index\`
     * into {@link getMeasurements}; the trailing in-progress line omits it.
     */
    get measurementScreenLines(): readonly MeasurementScreenLine[];
    /**
     * Vector annotations projected to the current frame's canvas pixels, so an
     * external overlay (a @niivue/uikit shape renderer through the overlay hook)
     * can draw the shapes + stats labels itself. Recomputed every frame. Pair with
     * \`isAnnotationDrawn = false\` to replace the built-in annotation rendering.
     */
    get annotationScreenShapes(): readonly AnnotationScreenShape[];
    get rulerWidth(): number;
    set rulerWidth(v: number);
    get graphNormalizeValues(): boolean;
    set graphNormalizeValues(v: boolean);
    /**
     * Volume+physio association graph: whether the crosshair BOLD/volume
     * time-course is shown as a series (default true). Set false to plot only the
     * attached physio traces (a "show fMRI trace" toggle).
     */
    get graphShowVolumeTimecourse(): boolean;
    set graphShowVolumeTimecourse(v: boolean);
    /**
     * Graph data-line thickness multiplier (relative to the DPI-scaled default,
     * 1). <1 thins lines so dense/overlapping traces separate; grid lines unchanged.
     */
    get graphLineWidth(): number;
    set graphLineWidth(v: number);
    /**
     * Opacity (0..1) of the multi-series graph data lines (default 1). Below 1,
     * overlapping traces are translucent so intersections are visible.
     */
    get graphLineAlpha(): number;
    set graphLineAlpha(v: number);
    get graphIsRangeCalMinMax(): boolean;
    set graphIsRangeCalMinMax(v: boolean);
    get volumeIllumination(): number;
    set volumeIllumination(v: number);
    get volumeTransmittanceCutoff(): number;
    set volumeTransmittanceCutoff(v: number);
    /**
     * What the 3D render tile draws: \`VOLUME_RENDER_MODE.COMPOSITE\` (default, the
     * OVER ray-march), \`VOLUME_RENDER_MODE.MAXIMUM\` (maximum-intensity
     * projection), or \`VOLUME_RENDER_MODE.SLICES\` (no march at all -- the three
     * crosshair planes, composited front to back, with overlays sampled on them
     * as the 2D tiles do). 2D slices draw a single plane and are unaffected.
     *
     * Only those three values are stored: a fractional value rounds to the
     * nearest mode and anything else falls back to COMPOSITE (see
     * {@link normalizeVolumeRenderMode}), because the shaders test the mode by
     * proximity while the CPU tests it exactly, and a value in between would have
     * the depth pick land on a plane the render never drew. The \`change\` event
     * carries the stored value.
     */
    get volumeRenderMode(): number;
    set volumeRenderMode(v: number);
    /**
     * Which stencil estimates the in-shader LAYER gradient used to light the
     * overlay and drawing ray-march passes from their own normals:
     * \`LAYER_GRADIENT_MODE.CENTRAL\` (default), \`BLOB\`, or \`SOBEL8\`. The
     * background volume is unaffected -- its gradient is precomputed into a
     * texture. Only matters when \`volumeIllumination\` is above 0, which is what
     * turns layer shading on. An out-of-range value falls back to CENTRAL in the
     * shader. See LAYER_GRADIENT_MODE for the accuracy measurements.
     */
    get volumeLayerGradientMode(): number;
    set volumeLayerGradientMode(v: number);
    /**
     * Samples per voxel along the ray in the 3D render. Higher values converge the
     * ray integral at a proportional fragment cost. Clamped to [1, 4]. This does
     * NOT remove concentric banding on smooth structures; for the reconstruction
     * filter see volumeIsCubicInterpolation.
     */
    get volumeSampleRate(): number;
    set volumeSampleRate(v: number);
    /**
     * Reconstruct the volume with a tricubic B-spline instead of hardware
     * trilinear in the 3D ray-march, removing the blocky texel staircase that C0
     * trilinear leaves on band edges. 2D slices are unaffected. Costs 8 fetches
     * per sample instead of 1. Chunked volumes need a brick halo of at least 2.
     * See VolumeRenderConfig.isCubicInterpolation.
     */
    get volumeIsCubicInterpolation(): boolean;
    set volumeIsCubicInterpolation(v: boolean);
    /**
     * Both LOD compensation settings are exact no-ops unless a multi-LOD chunked
     * volume is loaded, and nothing on screen says so. Surface that at the moment
     * the setting is made rather than leaving the caller to wonder. Silent when
     * no volume is loaded at all: setting these before \`loadVolumes\` is normal.
     */
    private _warnIfLodCompensationInert;
    /**
     * COARSE BRICKS LOOK TOO DARK next to fine ones -> raise this. (Too
     * TRANSPARENT rather than too dark -> \`volumeLodOpacityCompensation\`.)
     *
     * Coefficient for the per-level brightness compensation applied to coarse
     * multi-LOD bricks; 0 disables it, clamped to [0, 1]. Useful magnitudes are
     * small: the default is 0.08 per pyramid level and 0.2 is already strong.
     *
     * A coarse brick integrates darker than the fine data it stands in for
     * (averaging voxels destroys the colour/opacity correlation that front-to-back
     * compositing weights by), which reads as a brightness step at a LOD boundary.
     * The correction is one fixed step per pyramid level (\`1 - coefficient *
     * log2(k)\`). Empirical: sparse material loses more per level than dense.
     *
     * No-op on any volume that is not a multi-LOD chunked volume, and on the 3D
     * render in \`VOLUME_RENDER_MODE.SLICES\` (one sample per plane whatever the
     * level). Call \`lodCompensation()\` to see whether it applies and what each
     * level gets. See VolumeRenderConfig.lodBrightnessCompensation.
     */
    get volumeLodBrightnessCompensation(): number;
    set volumeLodBrightnessCompensation(v: number);
    /**
     * COARSE BRICKS LOOK TOO TRANSPARENT next to fine ones -> raise this. (Too
     * DARK rather than too transparent -> \`volumeLodBrightnessCompensation\`,
     * which is the one to try first.)
     *
     * Coefficient for the per-level OPACITY compensation applied to coarse
     * multi-LOD bricks in the 3D ray-march; 0 disables it (the default), clamped
     * to [0, 1], the same range as \`volumeLodBrightnessCompensation\`. The march's
     * step-size correction assumes a coarse voxel is homogeneous; where it is not,
     * the brick renders too see-through. This scales that exponent by
     * \`1 + c * (k - 1)\`.
     *
     * Measured off by default: it makes dense structure worse (the alpha there is
     * already correct, and inflating it front-loads the march onto nearer, dimmer
     * samples).
     *
     * No-op on any volume that is not a multi-LOD chunked volume, and on 2D slice
     * tiles (one sample, no accumulation). Call \`lodCompensation()\` to see whether
     * it applies and what each level gets. See
     * VolumeRenderConfig.lodOpacityCompensation.
     */
    get volumeLodOpacityCompensation(): number;
    set volumeLodOpacityCompensation(v: number);
    /**
     * Gradient-magnitude opacity modulation for the BACKGROUND volume's 3D
     * ray-march, [0, 1]; 0 (the default) is a no-op. Raising it suppresses
     * homogeneous interior while leaving edges intact: each sample's alpha is
     * scaled by \`magnitude ^ (gradientOpacity * 8)\`, and the magnitude is near 0
     * wherever the data is flat.
     *
     * Reads the magnitude from the precomputed background gradient texture, so it
     * does nothing to overlays or the drawing layer (those estimate a gradient
     * in-shader -- see \`volumeLayerGradientMode\`) and nothing on 2D slices, which
     * show one sample with no accumulation. Independent of \`volumeIllumination\`:
     * this changes opacity, that changes lighting, and either works alone.
     * See \`volumeSilhouette\` for the companion rim effect.
     */
    get volumeGradientOpacity(): number;
    set volumeGradientOpacity(v: number);
    /**
     * Silhouette (Fresnel rim) enhancement for the BACKGROUND volume's 3D
     * ray-march, [0, 1]; 0 (the default) is a no-op.
     *
     * Alpha is scaled by \`(1 - |dot(normal, rayDir)|) ^ silhouette\`, fading
     * material that faces the camera and keeping material seen edge-on, so a
     * surface reads as an outline; samples more view-aligned than \`1 - silhouette\`
     * are culled outright. Same background-only, 3D-only scope as
     * \`volumeGradientOpacity\`, and the two are independent.
     */
    get volumeSilhouette(): number;
    set volumeSilhouette(v: number);
    get volumeOutlineWidth(): number;
    set volumeOutlineWidth(v: number);
    get volumeAlphaShader(): number;
    set volumeAlphaShader(v: number);
    get volumeIsBackgroundMasking(): boolean;
    set volumeIsBackgroundMasking(v: boolean);
    get volumeIsAlphaClipDark(): boolean;
    set volumeIsAlphaClipDark(v: boolean);
    /**
     * Honour the background volume's per-voxel colormap alpha on 2D slices,
     * the way the 3D ray-march always has. Default false, because most neuro
     * colormaps ramp alpha near the low end and would gain a fade they never
     * had in 2D. Turn it on for a colormap that carries structure in alpha
     * (constant RGB, ramped A) or to make COLORMAP_TYPE's below-threshold
     * fade visible on the background in 2D.
     */
    get volumeIsColormapAlphaOn2D(): boolean;
    set volumeIsColormapAlphaOn2D(v: boolean);
    /**
     * Draw label/atlas volumes as region outlines rather than filled regions.
     *
     * \`outline\` is the neighbour probe distance in the atlas's own voxels: 0 (the
     * default) fills every region, 1 keeps a one-voxel border, larger values give
     * a thicker border. Only the interior is dropped, so the parcellation stays
     * readable over the anatomy underneath. Non-label volumes ignore it.
     *
     * Applies to every loaded label volume when \`volumeIndex\` is omitted, or to
     * one volume when it is given. It is a per-volume property, so
     * \`setVolume(i, { atlasOutline })\` and the load options reach it too.
     *
     * \`\`\`js
     * nv1.setAtlasOutline(1)     // outline every atlas
     * nv1.setAtlasOutline(0, 1)  // fill volume 1 again
     * \`\`\`
     */
    setAtlasOutline(outline: number, volumeIndex?: number): void;
    /**
     * Force nearest-neighbour 2D sampling for every volume. When false (the
     * default), each volume's \`isNearestInterpolation\` decides, which defaults to
     * nearest for label data and linear otherwise. The 3D render is always linear.
     */
    get volumeIsNearestInterpolation(): boolean;
    set volumeIsNearestInterpolation(v: boolean);
    /**
     * How overlapping overlays combine opacity: \`OVERLAY_ALPHA_BLEND.MAX\`
     * (default), \`ADDITIVE\` (for maps whose values sum to 1, e.g. tissue
     * fractions), or \`OVER\`. Only matters with two or more overlays.
     */
    get volumeOverlayAlphaBlend(): OVERLAY_ALPHA_BLEND;
    set volumeOverlayAlphaBlend(v: OVERLAY_ALPHA_BLEND);
    /**
     * Blend volumes[0] with the overlays as an equal channel instead of drawing
     * it as an opaque base; the fused channels land on the canvas background.
     * Pair with volumeOverlayColorBlend = OVERLAY_COLOR_BLEND.MAX for
     * fluorescence-style fusion. Stacked channels keep their colormap's alpha
     * ramp, where an overlay is otherwise fully opaque above calMin; in 3D each
     * channel's opacity sets how dense it looks. Ignored while volumes[0] is
     * chunked.
     */
    get volumeIsChannelStack(): boolean;
    set volumeIsChannelStack(v: boolean);
    /**
     * How overlapping overlays combine colour: \`OVERLAY_COLOR_BLEND.ADDITIVE\`
     * (default), \`MEAN\`, \`OVER\` (later overlays cover earlier ones), or \`MAX\`
     * (each component's brightest weighted value, as fluorescence viewers fuse
     * channels). Only matters with two or more overlays.
     */
    get volumeOverlayColorBlend(): OVERLAY_COLOR_BLEND;
    set volumeOverlayColorBlend(v: OVERLAY_COLOR_BLEND);
    get volumeIsV1SliceShader(): boolean;
    set volumeIsV1SliceShader(v: boolean);
    get volumeMatcap(): string;
    set volumeMatcap(v: string);
    get volumePaqdUniforms(): [number, number, number, number];
    set volumePaqdUniforms(v: [number, number, number, number]);
    get meshXRay(): number;
    set meshXRay(v: number);
    get meshThicknessOn2D(): number;
    set meshThicknessOn2D(v: number);
    get drawIsEnabled(): boolean;
    /**
     * Enable the raster drawing tools (pen/eraser/fill/magic wand). Mutually
     * exclusive with {@link annotationIsEnabled} in practice: with both on, raster
     * drawing intercepts the pointer and vector annotation editing is inert (the
     * first such interaction warns). Turn one off before turning the other on.
     * \`false\` stops editing but keeps the drawing visible; see \`closeDrawing()\`.
     */
    set drawIsEnabled(v: boolean);
    get drawPenValue(): number;
    set drawPenValue(v: number);
    get drawPenSize(): number;
    set drawPenSize(v: number);
    get drawPenShape(): PEN_SHAPE;
    /**
     * Footprint of the pen when \`drawPenSize\` is greater than one: a square
     * (\`PEN_SHAPE.RECTANGLE\`, the default) or a round brush (\`PEN_SHAPE.CIRCLE\`).
     */
    set drawPenShape(v: PEN_SHAPE);
    get drawIsFillOverwriting(): boolean;
    set drawIsFillOverwriting(v: boolean);
    get drawIsClickToSegment(): boolean;
    set drawIsClickToSegment(v: boolean);
    get drawClickToSegmentTolerance(): number;
    set drawClickToSegmentTolerance(v: number);
    get drawClickToSegmentIs2D(): boolean;
    set drawClickToSegmentIs2D(v: boolean);
    get drawOpacity(): number;
    set drawOpacity(v: number);
    get drawRimOpacity(): number;
    set drawRimOpacity(v: number);
    get drawColormap(): string;
    set drawColormap(v: string);
    get drawingVolume(): NVImage | null;
    set drawingVolume(vol: NVImage | null);
    get primaryDragMode(): number;
    set primaryDragMode(v: number);
    get secondaryDragMode(): number;
    set secondaryDragMode(v: number);
    get isSnapToVoxelCenters(): boolean;
    set isSnapToVoxelCenters(v: boolean);
    get isYoked3DTo2DZoom(): boolean;
    set isYoked3DTo2DZoom(v: boolean);
    /**
     * Anchor for the 2D wheel zoom: 'crosshair' (default) holds the crosshair
     * still; 'pointer' holds the point under the mouse pointer still, falling
     * back to the crosshair when the pointer picks no slice.
     */
    get wheelZoomAnchor(): WheelZoomAnchor;
    set wheelZoomAnchor(v: WheelZoomAnchor);
    get isViewModeHotKeyEnabled(): boolean;
    set isViewModeHotKeyEnabled(v: boolean);
    get isPanFollowingCrosshair(): boolean;
    /**
     * Opt-in: when the 2D views are zoomed in ({@link pan2Dxyzmm}\`[3] > 1\`) and
     * the crosshair moves on its own — keyboard step, {@link setCrosshairPos},
     * or a linked instance — pan just enough that it stays inside every tile's
     * visible window. Off by default (the window stays put and the crosshair may
     * leave it), and explicit pan/zoom gestures are never fought. Enabling also
     * applies immediately against the last rendered layout, so an already
     * off-window crosshair is brought back.
     */
    set isPanFollowingCrosshair(v: boolean);
    get annotationIsEnabled(): boolean;
    /**
     * Enable vector annotation editing. Mutually exclusive with
     * {@link drawIsEnabled} in practice: with both on, raster drawing intercepts
     * the pointer and vector annotation editing is inert (the first such
     * interaction warns). Turn one off before turning the other on. Does not
     * affect whether annotations *render* — they always do.
     */
    set annotationIsEnabled(v: boolean);
    get annotationActiveLabel(): number;
    set annotationActiveLabel(v: number);
    get annotationActiveGroup(): string;
    set annotationActiveGroup(v: string);
    get annotationBrushRadius(): number;
    set annotationBrushRadius(v: number);
    get annotationMergesOverlaps(): boolean;
    set annotationMergesOverlaps(v: boolean);
    get annotationIsErasing(): boolean;
    set annotationIsErasing(v: boolean);
    get annotationIsVisibleIn3D(): boolean;
    set annotationIsVisibleIn3D(v: boolean);
    get annotationStyle(): AnnotationStyle;
    set annotationStyle(v: AnnotationStyle);
    get annotationTool(): AnnotationTool;
    set annotationTool(v: AnnotationTool);
    get selectedAnnotation(): string | null;
    selectAnnotation(id: string | null): void;
    get annotations(): readonly VectorAnnotation[];
    addAnnotation(annotation: VectorAnnotation): void;
    /**
     * Set (or clear, with an empty string) the free-text label on an annotation by
     * id. The text shows above the annotation's stats via the overlay seam.
     */
    setAnnotationText(id: string, text: string): void;
    removeAnnotation(id: string): void;
    clearAnnotations(): void;
    /**
     * Serialize the vector annotations to a standalone SVG string (\`<path>\` per
     * polygon, one \`<g>\` panel per slice plane). \`sliceType\` defaults to the current
     * single-slice view; in render/multiplanar/none (no single plane on screen)
     * every plane is exported, each panel laid out left-to-right, so shapes drawn
     * directly on the 3D blocks all export rather than only those sharing the first
     * annotation's plane.
     *
     * Path coordinates are panel-local at mm scale; each \`<g>\` carries
     * \`data-origin-mm="minX maxY"\` to convert back (\`mmX = xLocal + minX\`,
     * \`mmY = maxY - yLocal\`).
     *
     * \`slicePosition\` restricts the export to one slice and requires a single plane
     * — a depth is measured along that plane's own axis, so it cannot select across
     * planes. Passing it with no single plane (and no explicit \`sliceType\`) warns
     * and is ignored. Returns null when there are no annotations.
     */
    annotationsToSVG(sliceType?: number, slicePosition?: number): string | null;
    annotationUndo(): void;
    annotationRedo(): void;
    getAnnotationsJSON(): string;
    loadAnnotationsJSON(json: string): void;
    protected enforceBackendAvailability(): void;
    /**
     * Register an external format loader.
     * The converter function receives raw file bytes and returns bytes in a known format.
     * @param converter - function that converts from the source format to the target format
     * @param fromExt - source file extension without dot (e.g. 'vox', 'glb')
     * @param toExt - target format extension without dot: 'nii' for volumes, 'mz3' for meshes
     */
    useLoader(converter: (buffer: ArrayBuffer) => ArrayBuffer | Uint8Array | Promise<ArrayBuffer | Uint8Array>, fromExt: string, toExt: string): void;
    private _checkBounds;
    attachTo(id: string, isAntiAlias?: null): Promise<this>;
    attachToCanvas(canvas: HTMLCanvasElement, isAntiAlias?: boolean | null): Promise<this>;
    /**
     * Rebuild every GPU resource from the model, re-uploading every mesh. The
     * setters (setVolume, setMesh, addMesh, ...) already rebuild only what they
     * changed; call this after editing loaded data in place yourself (e.g. a
     * mesh's \`colors\`): a setter does not notice such an edit. Cached volume
     * textures are reused unless something they were built from changed; after
     * editing a volume's \`img\` in place, set its \`isDirty\` first so its voxels
     * are re-uploaded (see {@link updateVolumeData} for the faster, scoped
     * path). Distinct meshes must not share their \`positions\`, \`indices\` or
     * \`colors\` arrays (e.g. a \`{ ...mesh }\` copy): recolouring one through
     * setMesh writes the shared array but re-uploads only that mesh, leaving the
     * other stale on screen.
     */
    updateGLVolume(): Promise<void>;
    /**
     * @internal Rebuild GPU resources after a setter changed volumes or scene
     * state: every volume and the colorbars, but only the meshes that are new,
     * removed or whose vertex data changed (see \`NVMesh._dataVersion\`).
     */
    _updateGLChanged(): Promise<void>;
    /**
     * Rebuild GPU resources after a mesh setter: upload new or edited meshes,
     * free removed ones and rebuild the colorbars (mesh layers and connectomes
     * add colorbars). Volume textures are left alone.
     */
    private _updateGLMeshes;
    /**
     * Rebuild GPU resources, coalescing calls that arrive while one is in
     * flight into a single follow-up. \`meshes\` picks which mesh resources to
     * rebuild (see MeshRebuild); \`volumes\` limits the volume rebuild to those
     * whose data changed (omitted = every volume, [] = none); \`colorbars\`
     * defaults to rebuilding them for a full volume rebuild only. A queued
     * follow-up takes the union of what the coalesced callers asked for.
     * Volumes flagged \`isDirty\` get a data-version bump first (so their textures
     * are re-uploaded) and join a scoped rebuild.
     */
    private _updateGL;
    /**
     * Take the update lock (\`_updating\`) for the current view. Returns a token
     * that \`_endUpdate\` checks, so a holder whose lock was taken over (see
     * \`_rebuildViewResources\`) cannot release its successor's lock.
     */
    private _beginUpdate;
    /**
     * Release the update lock if \`token\` still holds it and wake anything
     * awaiting \`_updateIdle\`. Returns false when the lock was taken over, in
     * which case the new holder runs the pending follow-up.
     */
    private _endUpdate;
    /** Run the single follow-up for updates coalesced while the lock was held. */
    private _runPendingUpdate;
    /**
     * Rebuild every GPU resource of the current view while holding the update
     * lock. View creation/recreation calls this rather than
     * \`view.updateBindGroups()\` directly: otherwise an update arriving meanwhile
     * (e.g. a per-frame \`updateVolumeData\`, or an \`updateMeshPositions\` falling
     * back to a rebuild because the new view has no buffers yet) runs a second
     * \`updateBindGroups\` on the same view concurrently. An in-flight update on
     * this same view is waited for. One still running on the view this one
     * replaced cannot touch the new view's resources, and may never settle if
     * that view's device is gone, so the lock is taken over instead of waited
     * for. Updates arriving during the rebuild queue behind it.
     */
    _rebuildViewResources(): Promise<void>;
    private updateVolumeAffineOnly;
    /**
     * Set a modulation image for a target volume. The modulator's intensity
     * (windowed by its own calMin/calMax) scales the target volume's brightness
     * (RGB) or opacity (alpha) per voxel.
     *
     * Works for both pre-baked RGB/RGBA volumes (V1 tensors) and plain
     * colormapped SCALAR overlays — for scalar overlays the weight is sampled in
     * the colormap GPU prepass through the modulator's overlay transform matrix,
     * so the modulator may live on any co-registered grid.
     *
     * NOTE: \`modulateAlpha\` differs by target type. For SCALAR overlays it selects
     * RGB (0) vs alpha (non-zero) modulation. For RGB/RGBA (V1 tensor) volumes,
     * only RGB is ever scaled — alpha is preserved to keep V1 sign-polarity bits
     * intact — so a non-zero \`modulateAlpha\` does NOT produce alpha modulation
     * there (it only sets the exponent for the unused alpha path). Background-volume
     * alpha modulation additionally needs \`volumeIsAlphaClipDark\` to show as
     * transparency.
     * @param targetId - ID of the volume to modulate
     * @param modulatorId - ID of the volume providing modulation (empty string to clear)
     * @param modulateAlpha - scalar overlays: 0 modulates RGB, non-zero modulates
     *   ALPHA with exponent \`max(1, |modulateAlpha|)\` (matching the original
     *   NiiVue). RGB/RGBA volumes always modulate RGB only.
     *
     * Re-invalidation: the scalar weight is cached by the modulator's buffer
     * identity + window + data version. Edit a modulator's voxels through
     * {@link updateVolumeData}, or mutate its \`img\` in place and set its
     * \`isDirty\` before the next update, and the weight is recomputed.
     */
    setModulationImage(targetId: string, modulatorId: string, modulateAlpha?: number): Promise<void>;
    /**
     * Convert a float32 3-frame volume to V1 (eigenvector) RGBA representation.
     * For formats like AFNI that lack NIfTI intent codes, this provides explicit
     * conversion of vector field data (dim4=3, float32) to sign-encoded RGBA.
     * @param volumeIndex - Index of the volume to convert
     * @param isFlipX - Flip X component (default: false)
     * @param isFlipY - Flip Y component (default: false)
     * @param isFlipZ - Flip Z component (default: false)
     */
    loadImgV1(volumeIndex: number, isFlipX?: boolean, isFlipY?: boolean, isFlipZ?: boolean): Promise<boolean>;
    /** Compute modulation data for all volumes that have modulationImage set. */
    private _computeModulationData;
    get backend(): BackendType | undefined;
    get isAntiAlias(): boolean;
    get isDragDropEnabled(): boolean;
    set isDragDropEnabled(enabled: boolean);
    get devicePixelRatio(): number;
    /** @deprecated Use devicePixelRatio */
    get forceDevicePixelRatio(): number;
    set devicePixelRatio(dpr: number);
    /** @deprecated Use devicePixelRatio */
    set forceDevicePixelRatio(dpr: number);
    getClipPlaneDepthAziElev(clipPlaneIndex?: number): [number, number, number];
    setClipPlaneDepthAziElev(depth: number, azimuth: number, elevation: number, clipPlaneIndex?: number): void;
    setClipPlane(depthAzimuthElevation: number[]): void;
    /**
     * Move the scene to \`target\` over time instead of in one jump: the camera,
     * zoom and pan, the crosshair, clip planes, and each volume's window,
     * opacity and 4D frame or each mesh's opacity. Anything the target leaves
     * out stays where it is. Every frame writes through the same public
     * setters, so the usual change events fire along the way.
     *
     * Only one transition runs at a time: a new call stops the one running
     * (it resolves with reason \`'superseded'\`) and starts from wherever that one
     * left the scene. By default pressing on or scrolling the canvas stops it
     * too. The promise resolves, never rejects, once the target is reached or
     * the transition is stopped. If the page stops drawing frames (a hidden
     * tab), the scene jumps to the target shortly after the duration and the
     * reason is \`'stalled'\`. If a setter throws or rejects while writing the
     * target, the reason is \`'failed'\` and \`failed\` names what did not land.
     *
     * A volume's window and opacity go through a GPU rebuild on every write,
     * so on a large or chunked volume those frames are dropped rather than
     * queued; camera, crosshair, clip plane and mesh opacity changes only
     * redraw.
     *
     * @example
     * await nv1.animateTo({ azimuth: 120, elevation: 20 }, { duration: 1000 })
     * await nv1.animateTo({ volumes: { 1: { opacity: 0 } } })
     * await nv1.animateTo({ azimuth: 360 }, { angles: 'literal', duration: 4000 })
     */
    animateTo(target: AnimationTarget, options?: AnimationOptions): Promise<AnimationResult>;
    /** Stop the running transition where it is (reason \`'stopped'\`). */
    stopAnimation(): void;
    /** True while an animateTo transition is running. */
    get isAnimating(): boolean;
    setClipPlanes(depthAziElevs: number[][]): void;
    private _loadDeferredData;
    get volumes(): NVImage[];
    get meshes(): NVMeshType[];
    loadMatcap(matcapName: string): Promise<void>;
    addVolume(volume: ImageFromUrlOptions | NVImage): Promise<this>;
    loadVolumes(volumes: ImageFromUrlOptions | NVImage | Array<ImageFromUrlOptions | NVImage>): Promise<this>;
    addMesh(mesh: MeshFromUrlOptions | NVMeshType): Promise<this>;
    loadMeshes(meshes: MeshFromUrlOptions | MeshFromUrlOptions[]): Promise<this>;
    get signals(): NVSignalType[];
    /** Add a pre-built signal or load one from a URL/File. */
    addSignal(signal: SignalFromUrlOptions | NVSignalType): Promise<this>;
    /** Load one or more signals (physio TSV or NIfTI/NIfTI-MRS). */
    loadSignals(signals: SignalFromUrlOptions | SignalFromUrlOptions[]): Promise<this>;
    /**
     * Add a spectroscopy signal whose spectrum is read live from the crosshair
     * voxel of a complex MRSI volume (loaded on the volume path; carries
     * \`complexFID\` + \`mrsMeta\`). The graph re-derives the voxel's spectrum on
     * every crosshair move — the core enabler for MRSI navigation. FSL-MRS
     * \`halveFirstPoint\` is on by default; pass \`display\` to override or to set a
     * ppm window/component. Throws if \`volumeId\` is not a loaded MRSI volume.
     */
    addMrsiSignal(volumeId: string, opts?: {
        name?: string;
        display?: Partial<NVSignalDisplay>;
        annotations?: SignalAnnotation[];
    }): this;
    removeSignal(index: number): this;
    removeAllSignals(): this;
    /** Emit a \`signalLocationChange\` readout for the given graph data + x value. */
    private emitSignalLocation;
    /**
     * Set the signal graph cursor from a plot-relative x fraction (0 = left edge,
     * 1 = right edge). Draws a faint marker line and emits \`signalLocationChange\`
     * with the values of every series at that location (for a status-bar readout).
     * In an associated volume+physio view it also scrubs the 4D volume to the
     * nearest frame.
     */
    setSignalCursorFraction(xFrac: number): this;
    /**
     * Set the signal cursor to a data-space x value (the marker). Keeps the marker
     * visible: if it lies outside the current zoom window, the window pans to it
     * (explicit zoom / pan buttons may hide the marker; a wheel-step follows it).
     */
    private setSignalCursorValue;
    /**
     * After the marker moves on its own (e.g. the wheel stepped the 4D frame), pan
     * the zoom window so the marker stays visible. No-op at full extent or when it
     * is already in view.
     */
    ensureGraphCursorVisible(): void;
    /**
     * Step the signal cursor along the x-axis by one wheel tick (fraction of the
     * visible window). Fallback scroll gesture for a signal graph with no spatial
     * volume to scrub (when a 4D volume is present, the wheel steps frames
     * instead). Starts from the window centre if no cursor has been set. When the
     * step crosses the visible window edge, the window pans to follow the marker.
     */
    stepSignalCursor(direction: number): this;
    /**
     * Zoom the signal graph's x-axis view window: \`factor\` > 1 zooms in, < 1 zooms
     * out, centred on the graph cursor when one is set (else the window centre).
     * Zooming out past the full extent restores the full view. No-op unless a
     * (dense) signal graph is shown.
     */
    graphZoom(factor?: number): this;
    /**
     * Pan the signal graph's x-axis view window by \`frac\` of its width (negative
     * pans toward earlier x / left). No-op when the full extent is shown.
     */
    graphPan(frac: number): this;
    /**
     * Reset the signal graph's zoom/pan to the full x-extent (clears the view
     * window). The one-click way back from a deep zoom; also bound to a
     * double-click on the graph. No-op when the full extent is already shown.
     */
    graphResetView(): this;
    /**
     * Set the signal graph's visible x-range to an explicit data-unit range
     * (order-insensitive), clamped to the full extent; \`null\` restores the full
     * view. For a host driving the range reactively (e.g. ppm sliders that mirror
     * the in-graph zoom via the \`graphRangeChange\` event). Pairs with
     * \`graphAutoResetView = false\` so the window is host-owned.
     */
    setGraphRange(range: [number, number] | null): this;
    /**
     * Whether an explicit-range display change (ppm window / ppm<->Hz / ppm ref)
     * resets the transient pan/zoom window so the new range is shown in full
     * (default true — see the \`graphRangeChange\` event for the reactive
     * alternative). Set false when a host owns the range via \`setGraphRange\`.
     */
    get graphAutoResetView(): boolean;
    set graphAutoResetView(v: boolean);
    /**
     * The signal graph's current visible x-range (the synchronous counterpart to
     * the \`graphRangeChange\` event): \`{ min, max, full, axisLabel, isWindowed }\`,
     * or null when no signal graph is shown. Use \`full\` to drive a "reset to full
     * extent" control (e.g. jump range sliders to the data limits).
     */
    getGraphRange(): GraphRangeChangeDetail | null;
    /**
     * Emit \`graphRangeChange\` with the signal graph's current visible x-range, so
     * a host UI (range sliders) can track the in-graph pan/zoom. No-op when no
     * signal graph is shown.
     */
    private emitGraphRange;
    /**
     * Re-emit the signal readout at the current marker (the associated volume's
     * frame time, else the last clicked cursor). Called on crosshair/frame changes
     * so the status bar reflects the current voxel value without a graph click.
     */
    refreshSignalLocation(): void;
    /** Update a loaded signal's display state (drives the on-demand transform). */
    setSignal(index: number, opts: {
        display?: Partial<NVSignalDisplay>;
        attachToId?: string;
        annotations?: SignalAnnotation[];
    }): this;
    addImage(pathOrFile: string | File, options?: Record<string, unknown>): Promise<void>;
    loadImage(pathOrFile: string | File, options?: Record<string, unknown>): Promise<void>;
    /**
     * Route a file/URL to the signal, mesh, or volume loader.
     *
     * - Signal-only extensions (e.g. TSV) and \`asSignal: true\` go to signals.
     * - Mesh extensions go to meshes.
     * - NIfTI is ambiguous: unless \`asSignal: false\`, its header dims are sniffed
     *   (signal only when it has no spatial extent: dim1-3 == 1, dim4 > 1). MRS
     *   sidecar/header fields do NOT affect routing. See {@link niftiBufferIsSignal}.
     * - Everything else is a volume.
     *
     * \`replace\` selects load-semantics (replace existing volumes/meshes) vs
     * add-semantics; signals always append.
     */
    private _dispatchImage;
    removeMesh(meshIndex: number): Promise<void>;
    removeAllVolumes(): Promise<void>;
    /**
     * Remove a single volume by index, emitting \`volumeRemoved\`.
     * @param volumeIndex - Index of the volume to remove
     * @example
     * await nv1.removeVolume(1) // remove the first overlay
     */
    removeVolume(volumeIndex: number): Promise<void>;
    removeAllMeshes(): Promise<void>;
    /**
     * Move a volume up one index position in the stack of loaded volumes (toward the top layer).
     * @param volumeIndex - Index of the volume to move
     * @example
     * await nv1.moveVolumeUp(0) // move the background image up one position
     */
    moveVolumeUp(volumeIndex: number): Promise<void>;
    /**
     * Move a volume down one index position in the stack of loaded volumes (toward the background).
     * @param volumeIndex - Index of the volume to move
     * @example
     * await nv1.moveVolumeDown(1) // move the second image down to the background position
     */
    moveVolumeDown(volumeIndex: number): Promise<void>;
    /**
     * Move a volume to the top position in the stack of loaded volumes (last index, top layer).
     * @param volumeIndex - Index of the volume to move
     * @example
     * await nv1.moveVolumeToTop(0) // move the background image to the top layer
     */
    moveVolumeToTop(volumeIndex: number): Promise<void>;
    /**
     * Move a volume to the bottom position in the stack of loaded volumes (index 0, background).
     * @param volumeIndex - Index of the volume to move
     * @example
     * await nv1.moveVolumeToBottom(3) // move the 4th volume to the background position
     */
    moveVolumeToBottom(volumeIndex: number): Promise<void>;
    /**
     * Set a label colormap on a volume (e.g., atlas/parcellation).
     * Converts the ColorMap definition to an LUT and attaches it to the volume.
     * When set, the orient shader uses nearest-neighbor label lookup instead of
     * continuous colormap interpolation, and locationChange events include label names.
     *
     * @param volumeIndex - Index of the volume to apply the label colormap to
     * @param cmap - ColorMap definition with R,G,B arrays and optional labels/I arrays;
     *               a built-in colormap name (e.g. 'freesurfer', resolved via
     *               lookupColorMap); or null to remove the label colormap
     */
    setColormapLabel(volumeIndex: number, cmap: ColorMap | string | null): Promise<void>;
    /**
     * Fetch a label colormap JSON from a URL or File and apply it to a volume.
     * The JSON should contain R, G, B arrays and optional labels/I arrays.
     *
     * @param volumeIndex - Index of the volume to apply the label colormap to
     * @param url - URL string or File object pointing to a colormap JSON
     */
    setColormapLabelFromUrl(volumeIndex: number, url: string | File): Promise<void>;
    getMeshShader(meshIndex: number): string | undefined;
    /**
     * Replace a loaded volume's voxel values and re-upload them to the GPU —
     * the fast path for animating or live-editing volume data. Only the edited
     * volume is reprocessed (plus any volume it modulates); meshes, colorbars
     * and unrelated volume layers are left alone.
     *
     * The new voxels are written into the volume's existing textures when it is
     * the background or the only overlay, scalar or RGB/RGBA alike (RGB/RGBA
     * voxels are reordered and padded to RGBA on the CPU first). The same holds
     * for a volume this one modulates: only its weight texture is rewritten,
     * as long as the modulator keeps its grid. These cases still allocate: with two or more overlays, every overlay is re-oriented
     * and blended into a new overlay texture; in multi-instance mode
     * (\`instances\`) the edited volume's texture is rebuilt; WebGPU background
     * masking writes the masked overlay to a new texture; and the gradient
     * texture is rebuilt when lighting needs one.
     *
     * Pass \`data\` with either every value of \`img\` (all frames) or one frame
     * (written into the current \`frame4D\`): \`nVox3D\` values for scalar volumes,
     * \`nVox3D * 3\` / \`nVox3D * 4\` bytes for RGB / RGBA. Values are RAW, in the
     * volume's native datatype and voxel order, before \`scl_slope\`/\`scl_inter\`
     * scaling (the same units as \`img\`, not as calMin/calMax). They are copied
     * into the existing \`img\`. Omit \`data\` after editing \`volume.img\` in place.
     * (The ordinary update path also picks up an in-place edit when the volume's
     * \`isDirty\` is set first: \`vol.isDirty = true; await setVolume(...)\` or
     * \`updateGLVolume()\`. That re-uploads the same data, but as part of a full
     * rebuild; volumes that are not dirty keep their textures either way.)
     *
     * The display window (calMin/calMax), robust range and other values derived
     * at load are NOT recomputed; call {@link recalculateCalMinMax} if the data's
     * range changed. Volumes streamed in chunks (\`chunkPlan\`, including volumes
     * the renderer chunked because they exceed the GPU texture limit) are
     * rejected with a warning.
     *
     * No \`volumeUpdated\` event is emitted: this is meant to be called every
     * frame, and it changes no display option.
     *
     * Calls that arrive while another GPU update is running are coalesced into a
     * single follow-up that uploads the latest data. Such a call's promise
     * resolves when it has been queued, before that follow-up runs, so awaiting
     * it does not guarantee the new voxels are on screen yet.
     *
     * @example
     * const vol = nv1.volumes[0]
     * const next = new Float32Array(vol.nVox3D)
     * // ...fill next...
     * await nv1.updateVolumeData(0, next)
     */
    updateVolumeData(volumeIndex: number, data?: ArrayLike<number>): Promise<void>;
    /**
     * Update display properties of a loaded volume.
     * Accepts any subset of volume display options (colormap, opacity, calMin, etc.)
     * and triggers a single GPU update. Note the display-window fields are the
     * camelCase calMin/calMax (matching VolumeUpdate / ImageFromUrlOptions); the
     * snake_case cal_min/cal_max are NIfTI header fields and are ignored here.
     *
     * @example
     * await nv1.setVolume(0, { colormap: 'hot', opacity: 0.8 })
     * await nv1.setVolume(1, { calMin: 10, calMax: 200, calMinNeg: -200, calMaxNeg: -10 })
     */
    setVolume(volumeIndex: number, options: VolumeUpdate): Promise<void>;
    /**
     * Region-of-interest statistics for a loaded volume.
     *
     * Values are calibrated (\`scl_slope\`/\`scl_inter\` applied) and non-finite
     * voxels are excluded. Every mask must sit on the same RAS grid as the
     * target volume — overlays are resliced to the background grid, so masks
     * drawn from the loaded volume list satisfy that by construction, but a mask
     * on a different grid returns \`null\` rather than silently wrong numbers.
     *
     * @param options.volumeIndex - which volume to measure (default 0, the background)
     * @param options.masks - the volumes that define the region. A volume index
     *   counts that volume's non-zero voxels; \`{ index, values }\` counts only the
     *   voxels whose calibrated value is one of \`values\` (label 0 included), to
     *   pick regions of an atlas or segmentation. With several masks, a voxel
     *   counts only where ALL of them keep it
     * @param options.isDrawingMask - also require a non-zero voxel in the drawing bitmap
     * @param options.drawPenValues - when masking by the drawing, restrict to these
     *   pen values (default: any non-zero voxel)
     * @returns the statistics, or \`null\` when the volume has no data, a mask
     *   index is out of bounds, a label list is empty, or a mask does not match
     *   the target grid
     *
     * @example
     * const roi = nv1.getDescriptives({ volumeIndex: 0, isDrawingMask: true })
     * console.log(roi.mean, roi.stdev, roi.volumeML)
     * // Statistics of atlas region 17 (the atlas loaded as volume 1)
     * const region = nv1.getDescriptives({ masks: [{ index: 1, values: [17] }] })
     */
    getDescriptives(options?: {
        volumeIndex?: number;
        masks?: Array<number | {
            index: number;
            values: number[];
        }>;
        isDrawingMask?: boolean;
        drawPenValues?: number[];
    }): DescriptiveStats | null;
    getVolumeAffine(volumeIndex: number): AffineMatrix;
    setVolumeAffine(volumeIndex: number, affine: number[][]): Promise<void>;
    applyVolumeTransform(volumeIndex: number, transform: AffineTransform): Promise<void>;
    resetVolumeAffine(volumeIndex: number): Promise<void>;
    /**
     * Tile a loaded volume into a \`gridDims\` grid of bricks and render it through
     * the chunked path, whatever its size. This is what makes
     * {@link setVolumeChunkExplode} possible on an ordinary volume. The halo is
     * the voxel overlap between bricks; the default of 3 satisfies cubic
     * interpolation. \`deviceLimit\` caps each brick's edge in texels and defaults
     * to 4096, which every WebGL2/WebGPU device this renders on accepts. Pass
     * \`null\` to return the volume to a single texture; this also clears any
     * explode. Reloads the volume's GPU textures, so it resolves once the bricks
     * are resident.
     */
    setVolumeChunkGrid(volumeIndex: number, gridDims: Vec3i | null, options?: {
        halo?: Vec3i;
        deviceLimit?: number;
    }): Promise<void>;
    /**
     * Resolves once the bricks the view asked for are resident and drawn: the
     * renderer admits one brick when the plan is set and streams the rest over
     * the following frames, and a change that rebuilds the bricks' textures
     * (turning on \`volumeIllumination\`, say) streams them again, so a
     * screenshot taken straight after {@link setVolumeChunkGrid} or such a
     * change would show a partly-tiled volume. Kicks a draw and resolves on the
     * first frame drawn after it that the view calls settled: nothing queued or
     * mid-upload for the working set that frame asked for, no brick still
     * cross-fading in over the coarse floor, no drag in progress. A 2D plane
     * through resident bricks only settles on that first frame, or once its
     * fade ends. Resolves at once when no volume is chunked or the tab is
     * hidden (it draws no frames, so there is no visible frame to settle), and
     * gives up quietly after \`timeoutMs\`.
     */
    whenChunkStreamSettles(timeoutMs?: number): Promise<void>;
    /**
     * Index into \`chunkPlan.chunks\` of the background volume's brick holding the
     * world-mm point, or -1 when the volume is not chunked or the point lies
     * outside it. The index is stable across explode changes, so it can key a
     * per-brick setting such as {@link setVolumeBrickOpacity}.
     */
    chunkBrickIndexAt(mm: ArrayLike<number>): number;
    /**
     * The eight world-mm corners of the background volume's brick holding the
     * point, where the render draws them (so moved by the explode when one is
     * on), or null when the volume is not chunked or the point is outside it.
     * Corner \`c\` takes the brick's high edge on x when bit 0 of \`c\` is set, on
     * y for bit 1 and on z for bit 2, so an edge joins corners whose indices
     * differ in one bit. Project them with {@link mmToRenderCanvas} to outline
     * the brick on the render.
     */
    chunkBrickCornersAt(mm: ArrayLike<number>): Array<[number, number, number]> | null;
    /**
     * Give each brick of a chunked volume its own opacity, indexed like
     * \`chunkPlan.chunks\` (see {@link chunkBrickIndexAt}); entries missing from
     * a short array count as 1. Each scales what that brick draws, colour and
     * coverage together, so the bricks behind a dimmed one show through it and
     * passing 1 for one brick and a small value for the rest keeps that brick
     * in focus. Pass \`null\` to restore every brick. The volume
     * must be chunked (see {@link setVolumeChunkGrid}); the renderer reads the
     * setting each frame, so this only redraws.
     */
    setVolumeBrickOpacity(volumeIndex: number, opacity: ArrayLike<number> | null): void;
    /**
     * Spread a chunked volume's bricks apart in the 3D render (an "exploded"
     * view). \`scale\` is the per-axis factor applied to each brick's offset from
     * the volume centre; 1 is unexploded and the default when \`enabled\` is set
     * without a scale is 1.5. Pass \`null\` to remove the explode. The volume must
     * be chunked first (see {@link setVolumeChunkGrid}); the renderer reads the
     * setting each frame, so this only redraws.
     */
    setVolumeChunkExplode(volumeIndex: number, explode: VolumeChunkExplode | null): void;
    /**
     * Where a world-mm point of the background volume is drawn once the
     * volume's explode (see {@link setVolumeChunkExplode}) has moved its brick.
     * Returns the input unchanged when the volume is not exploded. Overlays that
     * mark anatomy on an exploded render project this, not the raw point.
     */
    explodedMM(mm: [number, number, number]): [number, number, number];
    /**
     * Project a world-mm point onto the 3D render tile in canvas backing-store
     * pixels (origin top-left, y down), through the MVP the renderer cached on
     * its last draw. Returns null before the render tile has been drawn or when
     * the point is behind the camera. Unlike {@link mmToCanvas}, which serves
     * the 2D slice tiles, this is the projection an overlay needs to annotate the
     * 3D render.
     */
    mmToRenderCanvas(mm: [number, number, number]): [number, number] | null;
    private _getVolumeOrThrow;
    private _emitVolumeAffineUpdate;
    private _setVolumeAffine;
    /**
     * Replace a triangulated mesh's vertex positions and re-upload them into its
     * existing GPU buffer (normals are regenerated) — the fast path for animating
     * or deforming a mesh. Pass \`positions\` as x,y,z triples in mm with the same
     * vertex count the mesh already has; it is copied into \`mesh.positions\`.
     * Omit \`positions\` after editing \`mesh.positions\` in place yourself.
     *
     * Vertex normals are cached per mesh and recomputed only when \`positions\`
     * or \`indices\` is replaced with a new array or this method is called. If
     * you edit \`mesh.positions\` in place, call this method (or assign a new
     * array); otherwise later redraws keep the old normals.
     *
     * Scene extents are NOT recomputed, so the camera framing stays put while
     * vertices move. Only \`kind: 'mesh'\` is supported (tract and connectome
     * geometry is regenerated from their source data). No \`meshUpdated\` event is
     * emitted: this is meant to be called every frame, and it changes no display
     * option. If the mesh has no GPU buffer yet (e.g. while the view is being
     * rebuilt), a GPU update that uploads this mesh is scheduled instead.
     *
     * @example
     * const pts = nv1.meshes[0].positions
     * function frame(t) {
     *   for (let i = 2; i < pts.length; i += 3) pts[i] += Math.sin(t / 300) * 0.05
     *   nv1.updateMeshPositions(0)
     *   requestAnimationFrame(frame)
     * }
     * requestAnimationFrame(frame)
     */
    updateMeshPositions(meshIndex: number, positions?: ArrayLike<number>): void;
    /**
     * Update display properties of a loaded mesh.
     * Accepts any subset of mesh display options (opacity, shaderType, color, etc.)
     * and triggers a single GPU update. Only this mesh is re-uploaded, and only
     * when an option changes its vertex data (e.g. \`color\`); \`opacity\`,
     * \`visible\` and \`name\` just redraw. Meshes must not share their data
     * arrays (see {@link updateGLVolume}).
     *
     * @example
     * await nv1.setMesh(0, { shaderType: 'toon', opacity: 0.5 })
     * await nv1.setMesh(1, { color: [1, 0, 0, 1], colorbarVisible: false })
     */
    setMesh(meshIndex: number, options: MeshUpdate): Promise<void>;
    /**
     * Add a scalar overlay layer to a mesh.
     *
     * @example
     * await nv1.addMeshLayer(0, { url: 'brain.curv', colormap: 'gray', cal_min: 0.3, cal_max: 0.5 })
     */
    addMeshLayer(meshIndex: number, layerOpts: MeshLayerFromUrlOptions): Promise<this>;
    /**
     * Remove a scalar overlay layer from a mesh.
     */
    removeMeshLayer(meshIndex: number, layerIndex: number): Promise<this>;
    /**
     * Update properties of a mesh layer (colormap, cal_min, cal_max, opacity, etc.).
     * Triggers recompositing and GPU update.
     *
     * @example
     * await nv1.setMeshLayerProperty(0, 0, { colormap: 'hot', opacity: 0.8 })
     */
    setMeshLayerProperty(meshIndex: number, layerIndex: number, options: Partial<NVMeshLayer>): Promise<void>;
    /**
     * Set the current 4D frame for a mesh layer.
     */
    setMeshLayerFrame4D(meshIndex: number, layerIndex: number, frame: number): Promise<void>;
    /**
     * Update tract tessellation/display options and re-tessellate.
     *
     * @example
     * await nv1.setTractOptions(0, { fiberRadius: 0.8, fiberSides: 12 })
     */
    setTractOptions(meshIndex: number, options: Partial<NVTractOptions>): Promise<void>;
    /**
     * Get the group names for a tract mesh.
     * Returns an empty array if the mesh is not a tract or has no groups.
     */
    getTractGroups(meshIndex: number): string[];
    /**
     * Update connectome extrusion/display options and re-extrude.
     *
     * @example
     * await nv1.setConnectomeOptions(0, { nodeScale: 5, edgeMin: 3 })
     */
    setConnectomeOptions(meshIndex: number, options: Partial<NVConnectomeOptions>): Promise<void>;
    /**
     * Get the current 4D frame index for a volume.
     * @param id - Volume ID (typically the URL or name)
     * @returns Current frame index (0-based), or 0 if volume not found
     */
    getFrame4D(id: string): number;
    /**
     * Set the current 4D frame for a volume.
     * @param id - Volume ID (typically the URL or name)
     * @param frame - Frame index (0-based, clamped to valid range)
     */
    setFrame4D(id: string, frame: number): Promise<void>;
    /**
     * Recalculate robust cal_min/cal_max for a specific 4D frame (or the current frame).
     * Updates the volume's calibration range and triggers a GPU update.
     */
    recalculateCalMinMax(volumeIndex: number, frame?: number): Promise<void>;
    /**
     * Load all remaining frames for a 4D volume that was opened with limitFrames4D.
     * Re-fetches the complete file and replaces the truncated image data.
     * @param id - Volume ID (typically the URL or name)
     */
    loadDeferred4DVolumes(id: string): Promise<void>;
    /**
     * Convert RAS voxel coordinates to scene fraction [0,1].
     * Uses the background volume's matRAS for the vox→mm conversion.
     */
    vox2frac(vox: [number, number, number]): [number, number, number];
    getCrosshairPos(): [number, number, number];
    setCrosshairPos(pos: [number, number, number]): void;
    moveCrosshairInVox(di: number, dj: number, dk: number): void;
    createOnLocationChange(axCorSag?: number): void;
    /**
     * Update the drawing bounds for this Niivue instance.
     * Coordinates use y=0 at bottom, y=1 at top (GL convention).
     *
     * @param bounds - [x1, y1, x2, y2] in normalized (0-1) coordinates.
     *
     * Example:
     *   nv.setBounds([0,0,0.5,0.5])   // bottom-left quarter
     *   nv.setBounds([0.5,0.5,1,1])   // top-right quarter
     */
    setBounds(bounds: [number, number, number, number]): void;
    /**
     * Give this instance the whole canvas again, undoing {@link setBounds}.
     * Equivalent to \`setBounds([0, 0, 1, 1])\`.
     */
    clearBounds(): void;
    /**
     * Read the canvas-level viewport (virtual camera) shared with sibling instances.
     * The viewport applies a pan + zoom over the entire canvas before each instance's
     * \`bounds\` are projected to pixels. Identity is \`{pan: [0, 0], zoom: 1}\`.
     */
    getViewport(): CanvasViewport;
    /**
     * Streaming stats across all chunked volumes (base + independent overlay) on
     * the active backend: \`{ resident, pending, inFlight, total, staleDropped }\`
     * brick counts. Returns null before a view is attached. Useful for HUD / debug
     * overlays: \`resident < total\` with \`pending > 0\` for many frames indicates the
     * working set exceeds the residency budget (thrashing).
     *
     * To find out when streaming finishes, listen for the \`chunkStreamIdle\`
     * event (with \`chunkStreamProgress\` along the way) instead of polling this
     * on a timer — see {@link ChunkStreamDetail}.
     *
     * \`staleDropped\` is cumulative, not per frame: queued uploads retired because
     * the view moved on before they ran. It climbing during a pan or rotate is the
     * queue working as intended, since that work would otherwise have uploaded
     * bricks for viewports the user had already left.
     *
     * \`predicted\` is also cumulative: source reads started AHEAD of the working
     * set, from the direction the view is travelling. Those never enter the
     * upload queue, so they show up here and in the source's byte-cache hit rate
     * rather than in \`resident\`.
     *
     * \`decoded\` is the decoded-chunk tier summed over every chunked volume: the
     * CPU-side source bytes a brick is demoted to when the GPU evicts it. Its
     * hits are source reads that skipped the network AND the decode entirely,
     * costing only a texture upload; \`bytes\` / \`maxBytes\` is how full it is.
     */
    chunkStreamStats(): ChunkStreamDetail | null;
    /**
     * Where a streamed brick's time actually goes: bytes over the wire, the work
     * of turning them into a texture, and how much of that blocked the render
     * loop. Returns the process-wide totals since the last
     * {@link resetChunkTiming} — the recorder is a module-level singleton, so
     * this aggregates every chunked volume on every instance in the page, not
     * just this one.
     *
     * \`mainThreadMs\` (assemble + upload + gradient) is the figure that decides
     * whether a decode worker is worth building, and \`netBusyMs\` is network wall
     * clock with overlapping reads counted once. Phase definitions and the
     * accuracy of each number are in \`src/volume/chunkTiming.ts\`.
     */
    chunkTimingStats(): ChunkTimingSnapshot;
    /** Clear {@link chunkTimingStats} to start a fresh measurement window. */
    resetChunkTiming(): void;
    /**
     * What the two LOD compensation settings are actually doing right now.
     *
     * \`volumeLodBrightnessCompensation\` and \`volumeLodOpacityCompensation\` only
     * affect bricks fetched from a COARSE level of a multi-LOD chunked volume, so
     * on an ordinary volume they are exact no-ops with nothing on screen to say
     * so. This is the way to check: \`isActive\` answers "is anything being
     * compensated", \`inactiveReason\` says why not, and each level reports the
     * exponent and scale being handed to the shader for its bricks.
     *
     * \`\`\`js
     * const report = nv.lodCompensation()
     * if (!report.isActive) console.log(report.inactiveReason)
     * for (const each of report.levels) {
     *   console.log(each.level, each.downsample, each.brickCount, each.brightnessExponent)
     * }
     * \`\`\`
     *
     * Reads the background volume (\`volumes[0]\`), which is the volume both
     * settings act on. Cheap enough to call per frame for a debug HUD. In
     * \`VOLUME_RENDER_MODE.SLICES\` the reported exponent reaches the 2D tiles
     * only: the 3D planes take one sample per level and apply none.
     */
    lodCompensation(): LodCompensationReport;
    /**
     * Re-bake the streamed/chunked overlays in place: drop their resident bricks so
     * the next frame re-requests and re-bakes only the blocks in the current view
     * frustum, leaving the base volume resident. Use after changing a streamed
     * overlay's \`opacity\` (or any \`chunkSource\` whose output changed) to apply it
     * without the cost of a full \`loadVolumes\` reload. No-op before a view attaches.
     */
    rebakeChunkedOverlays(): void;
    /**
     * Set (or clear, with null) a coarse whole-volume "floor" for the streamed
     * base. On 2D slices the floor renders behind the resident fine chunks, so a
     * deep-zoom slice shows coarse detail immediately and never blanks while
     * finer chunks stream in — a smooth level-of-detail transition. \`coarseVol\`
     * is a small in-memory pyramid level (its own colormap/window); niivue stays
     * level-of-detail-agnostic and the app supplies it. No-op before a view
     * attaches or on a backend that has not implemented it. The level is meant
     * to be a separate volume, not one of \`volumes\`. Calling it again with the
     * same level re-orients it only when what the floor bakes changed (display
     * options, grid, \`img\`); after editing its \`img\` in place, set its \`isDirty\`
     * first.
     */
    setBaseCoarseFloor(coarseVol: NVImage | null): Promise<void>;
    /**
     * Swap a loaded chunked/streamed volume's tiling plan in place (e.g. a
     * multi-LOD refocus). Unchanged bricks keep their resident GPU textures; only
     * changed/new bricks stream. Far cheaper than reloading the volume, and it
     * doesn't reset the camera/crosshair. The volume must already be loaded with a
     * \`chunkSource\`; otherwise this is a no-op.
     */
    swapVolumeChunkPlan(volumeId: string, plan: ChunkPlan): Promise<void>;
    /**
     * Load a multi-resolution (pyramid) volume from a pluggable
     * {@link ChunkedVolumeSource} and render it with crosshair-focused level of
     * detail: the finest bricks stay around the crosshair while distant regions
     * render coarser, all under a brick/VRAM budget, so a very large finest level
     * (e.g. a 20+ GB whole-slide/OME-Zarr volume) is renderable without ever
     * making it fully resident. Returns an {@link NVChunkedVolume} handle
     * (\`setFocus\` / \`setMaxDetail\` / \`setBudget\` / \`dispose\`); with the default
     * \`focus: 'crosshair'\` it follows the crosshair automatically.
     *
     * ADDITIVE: the streamed volume is ADDED to the scene (via \`addVolume\`), not
     * swapped for the current volumes. To reload/replace a streamed volume, the
     * caller removes the previous one first. Because the outgoing volume is still
     * the base while this runs, a reload should call
     * {@link NVChunkedVolume.applyCoarseFloor} once it has removed it.
     *
     * Unless the \`coarseFloor\` option turns it off, the coarsest pyramid level is
     * also installed as the base coarse floor (see
     * {@link NiiVue.setBaseCoarseFloor}), so regions whose bricks are not yet
     * resident show coarse detail instead of the scene background.
     */
    loadChunkedVolume(source: ChunkedVolumeSource, options?: ChunkedVolumeOptions): Promise<NVChunkedVolume>;
    /**
     * Update the canvas-level viewport (virtual camera). All controllers sharing this
     * canvas resize and redraw together. \`pan\` is in normalized canvas units (GL convention,
     * y up); \`zoom\` is a positive scalar around the canvas centre.
     *
     * @param viewport - \`{ pan: [x, y], zoom }\`. Default identity keeps existing behavior.
     * @example
     *   nv1.setViewport({ pan: [0, 0], zoom: 1 })          // identity (no transform)
     *   nv1.setViewport({ pan: [0.5, 0], zoom: 1 })        // shift world right by half a canvas
     *   nv1.setViewport({ pan: [0, 0], zoom: 2 })          // zoom in 2x around canvas centre
     */
    setViewport(viewport: CanvasViewport): void;
    /**
     * Replace the multi-instance descriptor list (canvas tiling + optional global3d
     * volumes). Triggers a tile rebuild and redraw. \`null\` leaves instance mode and
     * restores the usual slice layout; an empty list stays in instance mode and
     * draws nothing. Entering or leaving
     * instance mode rebuilds the GPU resources, since the two modes keep volume
     * textures differently (a per-volume cache vs. a background + overlay stack).
     * Supported on both WebGL2 and WebGPU backends.
     */
    setInstances(instances: NVInstance[] | null): Promise<void>;
    /**
     * Update the shared 3D camera used by \`space === 'global3d'\` instances.
     * Supported on both WebGL2 and WebGPU backends.
     */
    setGlobalCamera(camera: NVGlobalCamera): void;
    /** @internal Rebuild the tiles from \`opts.instances\`; called by {@link applyInstances}. */
    updateTilesFromInstances(): void;
    /**
     * Register an NVSlide to render as a textured plane in the 3D render view,
     * laid into the loaded volume's world (mm) space. \`pixelToWorld\` maps slide
     * base pixels -> world mm (build one with \`axialPlaneTransform\` for an
     * axis-aligned plane). By default the pyramid level is chosen per-frame from
     * the camera distance (\`resolveSlidePlaneTiles\`) so the plane sharpens as you
     * zoom in; pass \`levelIndex\` to pin a fixed level. Tiles stream via NVSlide's
     * cache and the view redraws on its \`change\` event. Call \`clearSlidePlane()\`.
     */
    setSlidePlane(slide: NVSlide, opts: {
        pixelToWorld: readonly number[];
        levelIndex?: number;
    }): void;
    /**
     * Pin the slide plane's pyramid level (0 = finest), or return to the
     * camera-driven choice with undefined. Mutates the registered plane in
     * place, so — unlike re-calling {@link setSlidePlane} — the slide drawing
     * and vector annotations survive the change. No-op without a plane.
     */
    setSlidePlaneLevel(levelIndex?: number): void;
    /** Remove a slide plane registered with {@link setSlidePlane}. */
    clearSlidePlane(): void;
    /**
     * Re-push the registered slide plane (and its annotation) to a freshly
     * (re)created view — called from the view-lifecycle recreate paths so a
     * backend switch / reinitialize doesn't drop the slide. Internal.
     */
    restoreSlidePlaneView(): void;
    /**
     * Create a drawing surface in *slide* space for the registered slide plane.
     * The annotation is a label raster covering the whole slide (sized to the
     * slide aspect, long edge capped at \`maxRaster\`, default 4096) and is painted
     * with the existing pen tools (slideDrawAt / slideDrawUndo reuse drawPoint,
     * drawLine and the RLE undo stack), so it stays in slide coordinates and is
     * compatible with the volume drawing functions. Requires {@link setSlidePlane}.
     */
    createSlideDrawing(opts?: {
        maxRaster?: number;
    }): void;
    private _attachSlideDrawing;
    /** Map a canvas CSS pixel to slide base-pixel coords, or null off-plane. */
    slidePlanePick(cssX: number, cssY: number): {
        x: number;
        y: number;
    } | null;
    private _slideToRaster;
    /** Active slide drawing tool. */
    get slideTool(): SlideDrawTool;
    set slideTool(tool: SlideDrawTool);
    /** Magic-wand color tolerance (Euclidean RGB distance). */
    get slideWandTolerance(): number;
    set slideWandTolerance(v: number);
    /**
     * Draw on the slide at a canvas CSS pixel with the active {@link slideTool}.
     * \`begin\` starts a stroke (pen/eraser/filled), a single action (bucket/wand),
     * or a new polygon (vector); subsequent calls extend it. Call slideDrawEnd on
     * pointer-up. Returns false if the point misses the slide. Uses the model's
     * pen value/size (eraser = penValue 0).
     */
    slideDrawAt(cssX: number, cssY: number, begin: boolean): boolean;
    /** End the current slide stroke; commits filled-pen / vector polygons. */
    slideDrawEnd(): void;
    /** Undo the last slide action (vector tool removes the last polygon). */
    slideDrawUndo(): void;
    private _drawLabelColor;
    private _slideVectorColor;
    /**
     * Serialize one slice of the voxel drawing to a standalone SVG string
     * (run-length \`<rect>\`s per label color, sized in voxels). \`sliceType\` selects
     * the plane (AXIAL/CORONAL/SAGITTAL); it defaults to the current single-slice
     * view, or AXIAL for render/multiplanar/none. \`sliceIndex\` defaults to the
     * crosshair voxel on that axis. Returns null when no drawing is open.
     */
    drawingToSVG(sliceType?: number, sliceIndex?: number): string | null;
    private _buildSlideWandReference;
    /** Clear all slide annotation pixels. */
    clearSlideDrawing(): void;
    /** Vector annotation layer for the registered slide plane (slide-pixel coords). */
    get slideVector(): SlideVectorLayer | null;
    /** Rebuild the slide annotation overlay (raster + vector) and redraw. Call
     * after mutating \`slideVector\`. */
    refreshSlideAnnotation(): void;
    private _refreshSlideAnnotation;
    private _compositeSlideVectors;
    /**
     * Point the current view's controller hooks (UIKit overlay, GPU-context
     * recovery, chunk-streaming observer) at this controller. The view lifecycle
     * calls this the moment a view is published (attach, and every recreate
     * path), BEFORE the \`resize()\` that draws its first frame: a preloaded
     * chunked volume streams from that very first frame, and every frame after
     * it is self-driven (\`view.render()\`, not \`drawScene()\`), so a hook wired
     * only from \`drawScene\` would miss the whole episode. \`drawScene\` re-wires
     * on every controller-driven frame as well, which is harmless.
     *
     * Wiring the chunk-streaming observer onto a NEW view instance first resets
     * the emitter, so a mid-stream recreation cannot carry the old view's busy
     * episode into the new one; the old view's own hook is detached by its
     * \`destroy()\`.
     */
    _wireViewHooks(): void;
    drawScene(needsSync?: boolean): void;
    /**
     * Register a privileged overlay renderer (e.g. a @niivue/uikit widget). It is
     * called at the end of every frame, on whichever backend is live, to draw into
     * the same frame in screen space. Returns an unsubscribe function; you may also
     * call {@link unregisterOverlayRenderer}. See view/NVOverlayHook.ts.
     */
    registerOverlayRenderer(renderer: UIKitOverlayRenderer): () => void;
    /** Remove a previously registered overlay renderer. */
    unregisterOverlayRenderer(renderer: UIKitOverlayRenderer): void;
    /**
     * Automatic recovery from a lost GPU context (WebGL2 'webglcontextrestored',
     * or a WebGPU device-lost that isn't our own teardown). Everything the view
     * owned died with the context, so the view is rebuilt wholesale; volumes and
     * meshes live on the model and re-upload, and a streamed volume re-plans from
     * its \`chunkPlan\` on the next frame.
     *
     * Capped: if the cause is that this scene simply does not fit in VRAM, an
     * uncapped retry would loop lose -> rebuild -> lose forever. After the cap we
     * leave the message up and stop.
     */
    private _onGpuContextLost;
    /** Stable dispatcher fanned out to every registered overlay renderer. */
    private _dispatchOverlay;
    get colormaps(): string[];
    /**
     * Case-insensitive existence check for a registered colormap. Accepts
     * whatever casing the caller has on hand (e.g. a lowercased \`<select>\`
     * value) and compares against the canonical stored name. Prefer this
     * over \`nv1.colormaps.includes(...)\` — it handles the first-letter
     * canonicalization that \`addColormap\` and the filesystem auto-loader
     * apply internally.
     */
    hasColormap(name: string): boolean;
    get meshExtensions(): string[];
    get meshWriteExtensions(): string[];
    saveMesh(meshIndex: number, filename?: string, options?: WriteOptions): Promise<void>;
    saveBitmap(filename?: string, quality?: number): Promise<boolean>;
    get volumeWriteExtensions(): string[];
    /**
     * Save voxel-based image to disk.
     *
     * @param options - configuration object with the following fields:
     *   - \`filename\`: name of the NIfTI image to create. If empty, returns data only.
     *   - \`isSaveDrawing\`: whether to save the drawing layer or the background image
     *   - \`volumeByIndex\`: which image layer to save (0 for background)
     * @returns \`true\` if successful when writing to disk, or a \`Uint8Array\` if exported as binary data
     *
     * @example
     * niivue.saveVolume({ filename: "myimage.nii.gz", isSaveDrawing: true });
     * niivue.saveVolume({ filename: "myimage.nii" });
     */
    saveVolume(options?: SaveVolumeOptions): Promise<boolean | Uint8Array>;
    get volumeExtensions(): string[];
    get meshShaders(): string[];
    /**
     * Get list of available volume transform names.
     */
    get volumeTransforms(): string[];
    /**
     * Namespace for volume transform operations.
     * Each transform takes an NVImage and returns a new NVImage.
     * Transforms are auto-discovered plugins — no hardcoded knowledge of specific transforms.
     */
    get volumeTransform(): Record<string, (volume: NVImage, options?: TransformOptions) => Promise<NVImage>>;
    /**
     * Get metadata for a specific volume transform (options, description, resultDefaults).
     */
    getVolumeTransformInfo(name: string): TransformInfo | undefined;
    /**
     * Register an external volume transform at runtime.
     * External transforms manage their own Web Worker execution internally.
     */
    registerVolumeTransform(transform: VolumeTransform): void;
    /**
     * Create an extension context for interacting with this NiiVue instance.
     *
     * The context provides a stable API surface for extensions: live data
     * accessors, event subscriptions (including high-level slice pointer events),
     * safe write-back actions, and coordinate transform utilities.
     *
     * Call \`context.dispose()\` when the extension is deactivated to remove all
     * event listeners registered through the context.
     *
     * Multiple contexts can coexist — each tracks its own subscriptions.
     */
    createExtensionContext(): NVExtensionContext;
    setDragMode(mode: string | number): void;
    /**
     * Add a distance measurement between two mm-space points, exactly as if it
     * had been drawn interactively in \`DRAG_MODE.measurement\`: it renders on
     * every 2D slice tile whose slice plane contains both endpoints, emits
     * \`measurementCompleted\` (after the mutation), and redraws. \`opts\` may pin
     * the slice metadata (\`sliceIndex\`/\`sliceType\`/\`slicePosition\`); omitted
     * fields are derived from the segment geometry (see
     * control/measurements.buildMeasurement). An explicit \`sliceType\` must be a
     * 2D orientation (\`SLICE_TYPE.AXIAL\`/\`CORONAL\`/\`SAGITTAL\`); a non-2D value
     * (\`MULTIPLANAR\`/\`RENDER\`/\`NONE\`) warns and is ignored, deriving the
     * orientation from geometry. Returns the new measurement's index
     * (valid for {@link removeMeasurement} until an earlier one is removed).
     * @example
     * const idx = nv1.addMeasurement([-20, 10, 0], [25, 10, 0])
     */
    addMeasurement(startMM: [number, number, number], endMM: [number, number, number], opts?: AddMeasurementOptions): number;
    /**
     * Remove a single completed distance measurement by index, emitting
     * \`measurementRemoved\` before the mutation (so the listener can still reach
     * it) and redrawing. An index that is not an integer in bounds warns and
     * no-ops, matching {@link removeVolume}.
     */
    removeMeasurement(index: number): void;
    /**
     * All completed distance measurements, in insertion order (an entry's
     * position is the index {@link addMeasurement} returned and
     * {@link removeMeasurement}/{@link pickMeasurement} use). Returns a snapshot:
     * a fresh array of fresh entries, so editing it (an endpoint tuple included)
     * cannot change what is rendered, and it does not update when measurements
     * are later added, removed or cleared. Call it again for the current list,
     * and use {@link addMeasurement}/{@link removeMeasurement}/
     * {@link clearMeasurements} to change it so events fire and the scene
     * redraws.
     */
    getMeasurements(): readonly CompletedMeasurement[];
    /**
     * Find the completed distance measurement under a canvas point, e.g. to
     * implement click-to-select or click-to-delete. Each measurement is projected
     * with the same per-tile filtering and matrices the renderer uses to draw it,
     * so the hit-test agrees with what is on screen. Returns the index of the
     * closest measurement whose projected line is within \`radiusPx\` (default 8)
     * canvas pixels of the point, or null if none is. Requires a rendered frame
     * (the projection uses matrices cached during render).
     *
     * \`canvasX\`/\`canvasY\` are canvas BACKING-STORE pixels, the same convention
     * as {@link hitTest} and {@link canvasToMM}, not CSS pixels: a pointer
     * event's \`offsetX\`/\`offsetY\` are off by the device pixel ratio on any
     * display above 1x. Convert with {@link clientToCanvas} first.
     * @example
     * canvas.addEventListener('pointerdown', (e) => {
     *   const px = nv1.clientToCanvas(e.clientX, e.clientY)
     *   if (!px) return
     *   const idx = nv1.pickMeasurement(px[0], px[1])
     *   if (idx !== null) nv1.removeMeasurement(idx)
     * })
     */
    pickMeasurement(canvasX: number, canvasY: number, radiusPx?: number): number | null;
    /** Clear both completed distance measurements and completed angles. */
    clearMeasurements(): void;
    /** Clear completed angles only, leaving distance measurements in place. */
    clearAngles(): void;
    /** Clear completed distance measurements only, leaving angles in place. */
    clearDistanceMeasurements(): void;
    /**
     * Sync the scene controls (orientation, crosshair location, etc.) from one NiiVue instance to others.
     * @param targets - the other NiiVue instance(s) to broadcast to, or omit to clear sync
     * @param opts - which properties to sync (default: { '2d': true, '3d': true })
     * @example
     * nv1.broadcastTo(nv2)
     * nv1.broadcastTo([nv2, nv3])
     * nv1.broadcastTo() // clear sync
     */
    broadcastTo(targets?: NiiVue | NiiVue[], opts?: SyncOpts): void;
    private _sync;
    get drawingColormaps(): string[];
    createEmptyDrawing(): void;
    closeDrawing(): void;
    /**
     * Push the current drawing bitmap onto the undo stack, so the next
     * \`drawUndo()\` restores it. The built-in pen, fill and magic wand do this
     * before each edit; call it yourself before an edit made through the
     * extension context (\`ctx.drawing.update(bitmap)\`: an extension's wand,
     * slice interpolation, ...) so that edit is undoable too. Push once per
     * committed edit, not per hover preview. No-op without a drawing.
     * @example nv1.drawAddUndoBitmap(); ctx.drawing.update(bitmap)
     */
    drawAddUndoBitmap(): void;
    drawUndo(): void;
    /**
     * Mark the drawing texture as dirty and schedule a redraw.
     * The expensive bitmap→RGBA conversion and GPU upload are deferred to
     * the next animation frame, so rapid pointermove events only pay the
     * cost once per frame.
     */
    refreshDrawing(): void;
    /**
     * Expand the pending pen-stroke dirty box by a voxel and its pen radius, so
     * the next drawing flush re-uploads only the chunks that region touches. Call
     * this right before \`refreshDrawing()\` at each pen-stroke site; whole-bitmap
     * changes (undo, clear, recolour) skip it and fall back to a full upload.
     */
    markDrawDirty(x: number, y: number, z: number, radius?: number): void;
    /** Perform the actual bitmap→RGBA conversion and GPU texture upload. Called from drawScene RAF. */
    private _flushDrawing;
    saveDrawing(filename?: string): Promise<boolean | Uint8Array>;
    loadDrawing(source: string | File | ImageFromUrlOptions): Promise<boolean>;
    resize(): void;
    /**
     * Drop the frame that {@link drawScene} has scheduled but not yet drawn.
     * For callers that render the view themselves, such as a benchmark timing
     * each frame: a state change (for example {@link updateVolumeData}) also
     * schedules a frame, which would otherwise draw a second time.
     * @returns true when a scheduled frame was dropped
     */
    cancelPendingFrame(): boolean;
    destroy(): void;
    _recreateView(): Promise<void>;
    reinitializeView(options?: ReinitializeOptions): Promise<boolean>;
    /**
     * Swap the active font atlas. The font is infrastructure-level configuration
     * (GPU-owned atlas texture + metrics map), so switching requires a full view
     * rebuild — use this method instead of mutating \`opts.font\` directly.
     */
    setFont(font: NVFontData): Promise<boolean>;
    /**
     * Fetch an MSDF font atlas (PNG + JSON metrics pair) from URLs and swap
     * it in as the active font. Useful for loading fonts that are not bundled
     * with the library (e.g. the community atlases at
     * https://github.com/niivue/fonts). The PNG URL is stored verbatim and
     * used as the GPU atlas texture source.
     *
     * On failure (metrics fetch, view rebuild, or atlas texture upload)
     * the previous font is restored so the view isn't left half-initialized.
     * The original error is re-thrown after recovery.
     *
     * @example
     * await nv1.setFontFromUrl({ atlas: '…/ubuntu.png', metrics: '…/ubuntu.json' })
     */
    setFontFromUrl(urls: {
        atlas: string;
        metrics: string;
    }): Promise<boolean>;
    /**
     * Register a colormap by name so it becomes available to
     * \`setVolume({ colormap: name })\`, \`nv1.colormaps\`, colorbars, mesh
     * layers, and so on. Use this to add user-defined LUTs at runtime.
     * Re-registering an existing name replaces the entry. Does not trigger a
     * redraw — the colormap is inert until a volume references it. Volumes
     * that already use the name show the new colors on their next GPU update
     * (e.g. \`updateGLVolume()\`). Mesh layers, tracts and connectomes bake their
     * colors when built, so they pick them up on their next change
     * (\`setMeshLayerProperty\`, \`setTractOptions\`, \`setConnectomeOptions\`, ...).
     *
     * Label colormaps (for atlas volumes with per-index labels) have their
     * own registration path: \`setColormapLabel()\` / \`setColormapLabelFromUrl()\`.
     *
     * @returns The canonical name under which the colormap was stored
     *   (first letter upper-cased), which is the form visible in \`nv1.colormaps\`
     *   and the \`colormapAdded\` event detail.
     * @throws If \`R\`/\`G\`/\`B\` are empty, a single stop, or caller-supplied
     *   \`A\`/\`I\` arrays disagree in length.
     *
     * @example
     * const canonical = nv1.addColormap('myCmap', { R: [0, 255], G: [0, 128], B: [0, 0] })
     * await nv1.setVolume(0, { colormap: canonical })
     */
    addColormap(name: string, cmap: Pick<ColorMap, 'R' | 'G' | 'B'> & Partial<Pick<ColorMap, 'A' | 'I' | 'labels'>>): string;
    /**
     * Fetch a colormap JSON (\`{ R, G, B, A?, I? }\`) from a URL or \`File\` and
     * register it under \`name\`. When \`name\` is omitted, it is derived from
     * the source filename; callers passing an un-nameable source (e.g.
     * \`?query-only\`) should supply \`name\` explicitly — an empty derived
     * name throws.
     */
    addColormapFromUrl(url: string | File, name?: string): Promise<void>;
    /**
     * Shared fetch + parse helper for colormap JSON payloads. Returns the
     * parsed \`ColorMap\` plus a default name derived from the source filename
     * (extension stripped, including compound \`.json.gz\` / \`.gz\`).
     */
    private _fetchColormapJson;
    /**
     * Which settings saved documents include. Default \`{}\` omits any setting equal
     * to its default (documents are sparse). Set \`neverSave\` to omit settings even
     * when non-default (e.g. \`['scene.crosshairPos']\` to persist the user's last
     * crosshair across scenes) and \`alwaysSave\` to keep settings even at their
     * default. Applies to every \`saveDocument\`/\`serializeDocument\` unless a per-call
     * policy is passed. Transient — not part of the document.
     */
    get settingsSavePolicy(): SettingsSavePolicy;
    set settingsSavePolicy(v: SettingsSavePolicy);
    /**
     * How a loaded document's OMITTED settings are filled. Default (undefined)
     * resets each omitted setting to its built-in default, so a document is a
     * complete scene. Pass \`'current'\` to keep the instance's live value for all
     * omitted settings, or a map targeting groups / \`'group.key'\` paths (e.g.
     * \`{ 'scene.crosshairPos': 'current' }\` persists the user's crosshair across
     * scenes while resetting everything else). A setting the document specifies
     * always wins. A per-call \`fill\` on \`loadDocument\` overrides this. Transient.
     */
    get settingsFillPolicy(): SettingsFillPolicy | undefined;
    set settingsFillPolicy(v: SettingsFillPolicy | undefined);
    /**
     * Return the current scene serialized as an NVD document (Uint8Array).
     * \`options.settings\` overrides the instance \`settingsSavePolicy\`;
     * \`options.linkData\` saves a small "linked" document that references volumes by
     * URL instead of embedding their bytes; \`options.format\` is \`'cbor'\` (default,
     * binary) or \`'json'\` (portable text). \`loadDocument\` accepts either encoding.
     */
    serializeDocument(options?: NVDocument.SerializeOptions): Uint8Array;
    private _slidePlaneToDoc;
    private _restoreSlidePlaneFromDoc;
    saveDocument(filename?: string, options?: NVDocument.SerializeOptions): void;
    private emitSettingsChanges;
    loadDocument(source: string | File, options?: {
        fill?: SettingsFillPolicy;
    }): Promise<void>;
}
`,a=/^ {4}(?:(async) )?(get )?([a-zA-Z]\w*)(\(.*\)): (.*);$/,o=e=>(e.join(` `).split(/\s{2,}|(?<=\.) (?=[A-Z])/)[0]??``).trim();function s(e){let t=new Map,n=new Set([...e.matchAll(/^ {4}set (\w+)\(/gm)].map(e=>e[1])),r=[],i=!1;for(let s of e.split(`
`)){let e=s.trim();if(e.startsWith(`/**`)&&(r=[],i=!1),e.startsWith(`*`)||e.startsWith(`/**`)){let t=e.replace(/^\/?\*+\/?\s?/,``).replace(/\*\/$/,``).trim();t.startsWith(`@`)&&(i=!0),!i&&t&&r.push(t);continue}let c=s.match(a);if(c&&!t.has(c[3])){let[,,e,i,a,s]=c;t.set(i,{name:i,sig:e?`nv.${i}: ${s}`:`nv.${i}${a}: ${s}`,doc:o(r),settable:!!e&&n.has(i)})}e&&!e.startsWith(`*`)&&(r=[])}return[...t.values()].sort((e,t)=>e.name.localeCompare(t.name))}var c=()=>s(i),l=n();function u({insert:e}){let t=(0,r.useMemo)(c,[]),[n,i]=(0,r.useState)(``),a=t.filter(e=>`${e.name} ${e.doc}`.toLowerCase().includes(n.toLowerCase()));return(0,l.jsxs)(`div`,{className:`reference`,children:[(0,l.jsx)(`input`,{type:`search`,placeholder:`Filter ${t.length} methods and properties`,"aria-label":`Filter reference`,value:n,onChange:e=>i(e.target.value)}),(0,l.jsx)(`ul`,{children:a.map(t=>(0,l.jsxs)(`li`,{children:[(0,l.jsx)(`button`,{type:`button`,className:`link`,onClick:()=>e(`nv.${t.name}`),children:(0,l.jsx)(`code`,{children:t.sig})}),t.doc&&(0,l.jsx)(`p`,{children:t.doc})]},t.name))})]})}export{u as default};