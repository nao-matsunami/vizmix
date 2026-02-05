const shader = `
// Kinetic Lines - Moving Grid Patterns
// Theme: Minimalist white lines on black
//
// ISF_INPUTS: u_mode(long,0,0,2), u_line_count(float,10.0,1.0,50.0), u_line_width(float,0.2,0.01,1.0), u_speed(float,1.0,0.0,5.0), u_grid_split(float,1.0,1.0,10.0), u_randomness(float,0.0,0.0,1.0)

// Random helper
float hash12(vec2 p) {
	vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    
    // Aspect ratio correction for the content logic
    vec2 p = uv;
    p.x *= iResolution.x / iResolution.y;

    // Parameters
    int u_mode = 0; // 0:Vertical(Up), 1:Horizontal(Right), 2:Diagonal
    float u_line_count = 10.0;
    float u_line_width = 0.2; // Relative to cell size (0..1)
    float u_speed = 1.0;
    float u_grid_split = 1.0; // Screen split count (e.g., 2x2)
    float u_randomness = 0.0;
    
    // 1. Grid Split Logic
    // Divide screen into u_grid_split * u_grid_split areas
    vec2 gridUV = uv * u_grid_split;
    vec2 gridID = floor(gridUV);
    vec2 gridLocal = fract(gridUV);
    
    // Modify direction/speed based on gridID
    // Checkerboard pattern for reversal
    float cellIndex = gridID.x + gridID.y;
    float dirMult = (mod(cellIndex, 2.0) < 0.5) ? 1.0 : -1.0;
    
    // Random offset per cell
    float cellRand = hash12(gridID);
    
    // Adjust coordinate space for Lines
    // p is now based on gridLocal but aspect corrected within the cell?
    // Actually simpler to just transform 'p' based on grid splits if we want continuity,
    // but the request implies "VJ complexity" -> separate animations per cell.
    // Let's treat each cell as a mini-screen.
    
    vec2 localP = gridLocal;
    // Aspect correction within cell?
    // Cell aspect = (Res.x / split) / (Res.y / split) = Res.x / Res.y
    localP.x *= iResolution.x / iResolution.y;
    
    // Mode Transformation (Coordinate Rotation)
    vec2 st = localP;
    if (u_mode == 1) {
        // Horizontal (Left to Right) -> Lines are vertical, moving x? 
        // "Left to Right" usually means lines move towards right. 
        // If lines are vertical bars | | |, moving right: x changes.
        // So we are interested in x coordinate for the pattern.
        st = localP; // x is primary
    } else if (u_mode == 0) {
        // Vertical (Bottom to Up) -> Lines are horizontal _ _ _, moving up.
        // Primary axis is y.
        st = vec2(localP.y, localP.x); 
    } else {
        // Diagonal
        // Rotate 45 deg
        float c = 0.7071;
        float s = 0.7071;
        st = vec2(c * localP.x - s * localP.y, s * localP.x + c * localP.y);
    }
    
    // 2. Line Pattern Generation
    // We want 'u_line_count' lines across the unit space (or cell space)
    
    // Add randomness to line count or spacing?
    // u_randomness affects spacing or speed variance?
    // Let's affect speed and offset.
    
    float speed = u_speed * 0.5 * dirMult;
    
    // Random speed variance per cell
    if (u_randomness > 0.0) {
        speed *= (1.0 + (cellRand - 0.5) * u_randomness * 2.0);
    }
    
    float t = iTime * speed;
    
    // Pattern Coordinate: pos
    float pos = st.x; 
    
    // To make lines, we scale pos by count
    // But we want variable spacing if randomness is high?
    // Simpler: Uniform spacing + random offset per line is hard in shader without loop.
    // Standard approach: fract(pos * count + t)
    
    // Add randomness to the *phase* of the lines based on the perpendicular axis? 
    // This creates "glitchy" lines.
    float perpRand = 0.0;
    if (u_randomness > 0.0) {
       // Noise based on integer part of perpendicular axis
       // float stripeID = floor(st.y * 10.0); // e.g. 10 segments along the line
       // perpRand = hash12(vec2(stripeID, cellIndex)) * u_randomness;
       // This makes lines broken/dashed. Maybe too complex?
       // Let's keep it clean: Randomness affects the cell properties mainly.
    }
    
    float pattern = fract(pos * u_line_count - t);
    
    // Line width check
    // pattern goes 0 to 1.
    // Center at 0.5. width is u_line_width (0..1 fraction of spacing)
    
    float halfWidth = u_line_width * 0.5;
    float dist = abs(pattern - 0.5);
    
    // Smooth edges
    float aa = fwidth(dist); // Anti-aliasing
    // or constant softness
    aa = 0.01;
    
    float line = smoothstep(halfWidth + aa, halfWidth - aa, dist);
    
    // Output Color
    vec3 col = vec3(line);
    
    fragColor = vec4(col, 1.0);
}

`;