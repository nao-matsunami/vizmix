const shader = `
// Minimal Shapes - Pure White Expanding Forms
// Theme: Minimalist white shapes on black, center-expanding loop
//
// ISF_INPUTS: u_shape(int,0,0,2), u_fill(float,0.0,0.0,1.0), u_thickness(float,0.03,0.01,0.2), u_speed(float,1.0,0.1,5.0)

// ============================================
// SDF Primitives
// ============================================

// Circle SDF
float sdCircle(vec2 p, float r) {
    return length(p) - r;
}

// Square SDF
float sdSquare(vec2 p, float size) {
    vec2 d = abs(p) - vec2(size);
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// Equilateral Triangle SDF
float sdTriangle(vec2 p, float r) {
    const float k = sqrt(3.0);
    p.x = abs(p.x) - r;
    p.y = p.y + r / k;
    if (p.x + k * p.y > 0.0) {
        p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
    }
    p.x -= clamp(p.x, -2.0 * r, 0.0);
    return -length(p) * sign(p.y);
}

// ============================================
// Shape Selector
// ============================================
float getShape(vec2 p, float size, int shape) {
    if (shape == 0) {
        return sdCircle(p, size);
    } else if (shape == 1) {
        return sdSquare(p, size);
    } else {
        return sdTriangle(p, size);
    }
}

// ============================================
// Constants
// ============================================
#define PI 3.14159265359

// ============================================
// SDF Primitives
// ============================================

float sdCircle(vec2 p, float r) {
    return length(p) - r;
}

// Regular Polygon SDF (n sides)
float sdPolygon(vec2 p, float n, float r) {
    // Angle per sector
    float an = PI / n;
    float he = r * cos(an); // distance to edge center
    
    // Rotate p to the canonical sector
    float angle = atan(p.y, p.x); // -PI to PI
    float sector = floor(0.5 + angle / (2.0 * an));
    float theta = sector * 2.0 * an;
    
    // Rotate p by -theta
    float c = cos(theta);
    float s = sin(theta);
    p = mat2(c, s, -s, c) * p;
    
    // Distance to line x = he (if aligned?) 
    // Actually, let's use the IQ formula approach for exact distance
    // p is now locally aligned. We want dist to vertical line at x=he? 
    // No, standard polygon orientation usually has a vertex at (r,0) or similar.
    // Let's use a simpler known formula:
    
    // d = x*cos(an) + y*sin(an) - r*cos(an) ???
    
    // Re-evaluating IQ's signed distance regular polygon:
    // float bn = an*2.0;
    // p = vec2(cos(floor(0.5+a/bn)*bn-a)*length(p), sin(...) ...);
    // return length(p-vec2(r,0).xx...) 
    
    // Working implementation:
    float bn = 2.0 * an;
    angle -= bn * floor((angle + an) / bn);
    p = length(p) * vec2(cos(angle), sin(angle));
    
    // Distance to line segment from (r, 0) to (r*cos(2an), r*sin(2an))? 
    // Actually, simpler: p.x is dist along radius, p.y is dist tangent
    // We want distance to the edge x = r approx?
    
    // Let's use:
    p.x -= r;
    // But we need exact Euclidean distance for thickness
    // This is getting complex for a simple visual.
    // Let's use a standard approximation or simple math:
    
    // Dist to line: dot(p, N) - d
    // N = (cos(an), sin(an))
    return dot(p - vec2(r, 0.0), vec2(cos(an), sin(an))); // Wrong normal
}

// Better Polygon SDF
float sdRegularPolygon(vec2 p, float r, float n) {
    // Rotate so a vertex is at (r, 0)
    float an = PI / n;
    float bn = 2.0 * an;
    float angle = atan(p.y, p.x) + 0.5 * bn; // Offset to align
    
    // Symmetry
    float sector = floor(angle / bn);
    angle = mod(angle, bn) - an;
    
    p = length(p) * vec2(cos(angle), abs(sin(angle)));
    
    p -= vec2(r, 0.0);
    // Now p is relative to vertex. Edge is perpendicular to normal.
    // Normal is (-sin(an), cos(an)) ? No.
    // Edge vector is vertical-ish?
    // Let's just use the IQ one exactly.
    
    return length(p) * cos(atan(p.y, p.x) - round(atan(p.y, p.x) / bn) * bn) - r * cos(an);
}

// Robust IQ version
float sdPoly(in vec2 p, in float n, in float r) {
    float an = PI / n;
    float bn = 2.0 * an;
    float a = atan(p.y, p.x);
    float b = bn * floor((a + an) / bn);
    
    vec2 cs = vec2(cos(b), sin(b));
    p = mat2(cs.x, cs.y, -cs.y, cs.x) * p;
    
    // p is now in the fundamental sector.
    // The edge is the line segment from (r, tan(an)*r) ? No.
    // Side is vertical line x = r*cos(an)?
    return length(p) * cos(atan(p.y, p.x)) - r * cos(an); 
    // Wait, cos(atan(y,x)) is just x/length. So x - r*cos(an).
    // This is correct for the interior. 
    // p.x - r*cos(an)
    
    // Actually, simpler:
    // return dot(p, vec2(cos(an), sin(an))) - r*cos(an); 
}

// Corrected Signed Distance to Regular Polygon (n >= 3)
float getPolygonDist(vec2 p, float n, float r) {
    float an = PI / n;
    float bn = 2.0 * an;
    float a = atan(p.y, p.x) + PI/2.0; // Rotate to have flat bottom or top
    
    // Sector symmetry
    float b = bn * floor((a + an) / bn);
    vec2 cs = vec2(cos(b), sin(b));
    p = mat2(cs.x, -cs.y, cs.y, cs.x) * p; // Rotation
    
    // Distance to line x = r * cos(an)
    return (p.x - r * cos(an)); 
    // Note: This is an approximation for 'd', good for rendering but corner rounding might be sharp.
    // For "minimal shapes" it's fine.
}

// ============================================
// Main Composition
// ============================================
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // Parameters (defaults/overridden by ISF)
    float u_sides = 50.0;       // 3.0=triangle. >=10.0 treated as circle
    float u_fill = 1.0;         // 1.0 = fill
    float u_thickness = 0.03;
    float u_speed = 1.0;
    float u_offset = 0.0;
    float u_softness = 0.005;
    float u_spin = 0.0;         // Rotation speed
    float u_grid = 1.0;         // Grid cells (1.0 = 1x1)
    float u_radial_mode = 0.0;  // 1.0 = enable
    float u_count = 1.0;        // Layer count

    // Normalize UV
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    // Grid Logic
    if (u_grid > 1.0) {
        uv *= u_grid;
        uv = fract(uv + 0.5) - 0.5;
    }
    
    // Rotation (Spin)
    if (abs(u_spin) > 0.001) {
        float ang = iTime * u_spin;
        float c = cos(ang);
        float s = sin(ang);
        uv = mat2(c, -s, s, c) * uv;
    }

    vec3 finalCol = vec3(0.0);
    
    // Loop for layers (Radial Mode)
    // If radial mode is off, loop runs once
    float layers = (u_radial_mode > 0.5) ? max(1.0, u_count) : 1.0;
    
    for (float i = 0.0; i < 20.0; i++) {
        if (i >= layers) break;
        
        // Offset time per layer
        float layerOffset = (layers > 1.0) ? (i / layers) : 0.0;
        
        // Expanding animation
        // fract(TIME * speed + offset + layer_offset)
        float linear_t = fract(iTime * u_speed * 0.5 + u_offset - layerOffset);
        
        // Easing
        float t = pow(linear_t, 2.0);
        
        // Size
        float maxSize = 2.0;
        // If grid is active, adjust max size to fit cell? 
        // No, let it clip naturally or fill.
        float size = t * maxSize;
        
        // SDF
        float d = 0.0;
        if (u_sides >= 10.0) {
            d = sdCircle(uv, size);
        } else {
            d = getPolygonDist(uv, floor(u_sides), size);
        }
        
        // Render
        float filledShape = smoothstep(u_softness, -u_softness, d);
        float strokedShape = smoothstep(u_thickness + u_softness, u_thickness - u_softness, abs(d));
        float shape = mix(strokedShape, filledShape, u_fill);
        
        // Accumulate (Add or Mix?)
        // Additive blending for "light" feel
        finalCol += vec3(shape);
    }
    
    // Clamp
    finalCol = min(finalCol, vec3(1.0));

    fragColor = vec4(finalCol, 1.0);
}

`;