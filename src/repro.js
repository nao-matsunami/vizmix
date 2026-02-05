import * as pc from "playcanvas";

// 1. Setup App
const canvas = document.getElementById("application-canvas");
const app = new pc.Application(canvas, {
    graphicsDeviceOptions: { alpha: false }
});
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.start();

// 2. Create Camera (Orthographic)
// orthoHeight: 1 means the view volume is from Y=-1 to Y=+1.
// Total visible height = 2 units.
const camera = new pc.Entity("Camera");
camera.addComponent("camera", {
    projection: pc.PROJECTION_ORTHOGRAPHIC,
    orthoHeight: 1, 
    clearColor: new pc.Color(0.2, 0.2, 0.2)
});
camera.setPosition(0, 0, 10);
app.root.addChild(camera);

// 3. Create Plane
const plane = new pc.Entity("VideoPlane");
plane.addComponent("render", {
    type: "plane"
});

// Rotate -90 on X to face the camera (which looks down -Z)
// Default Plane is on XZ. Rotation makes it XY (facing Z).
plane.setLocalEulerAngles(-90, 0, 0);

// Material (Magenta for visibility)
const material = new pc.StandardMaterial();
material.emissive = new pc.Color(1, 0, 1);
material.useLighting = false;
material.update();
plane.render.material = material;

app.root.addChild(plane);

// 4. Resize Logic (Cover Mode)
function updateLayout() {
    // Current Screen Aspect Ratio
    const screenAspect = camera.camera.aspectRatio;
    
    // View Height in World Units
    // orthoHeight is Half-Height. Total Height = orthoHeight * 2
    const viewHeight = camera.camera.orthoHeight * 2;
    const viewWidth = viewHeight * screenAspect;

    // Target Content Aspect Ratio (e.g., 16:9 Video)
    const videoAspect = 16 / 9;

    let planeWidth, planeHeight;

    // Cover Logic
    if (screenAspect > videoAspect) {
        // Screen is wider than video -> Match Width
        planeWidth = viewWidth;
        planeHeight = planeWidth / videoAspect;
    } else {
        // Screen is taller than video -> Match Height
        planeHeight = viewHeight;
        planeWidth = planeHeight * videoAspect;
    }

    // Apply Scale
    // For a Plane rotated -90 on X:
    // Local X = World Width
    // Local Z = World Height
    plane.setLocalScale(planeWidth, 1, planeHeight);

    console.log(`
    Screen Aspect: ${screenAspect.toFixed(2)}
    View Size: ${viewWidth.toFixed(2)} x ${viewHeight.toFixed(2)}
    Plane Scale: ${planeWidth.toFixed(2)} x ${planeHeight.toFixed(2)}
    `);
}

// Initial calculation
updateLayout();

// Handle resize
window.addEventListener("resize", () => {
    app.resizeCanvas();
    updateLayout();
});
