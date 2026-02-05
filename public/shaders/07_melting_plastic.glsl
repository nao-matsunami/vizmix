const shader = `
precision highp float;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.7, 31.1))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), f.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}

// Helper for seamless looping
vec3 getPlastic(vec2 uv, float t) {
    float n = noise(uv * 3.0 + t);
    vec2 flow = vec2(n, noise(uv * 3.0 + t + 10.0));
    
    // Domain warping
    vec2 q = uv + flow * 0.5;
    float f = noise(q * 4.0 - t * 0.5);
    
    // High saturation colors
    // Time in cos must also loop if t loops. 
    // But we are blending the whole result?
    // Blending colors might look muddy if phases are off.
    // Better to blend the underlying noise `f` and `n`? 
    // Actually, blending the final color is easiest for general "seamless" feel if texture is chaotic.
    // However, let's try to make the inputs periodic? No, noise is not periodic.
    // Let's blend the final color.
    
    vec3 col = 0.5 + 0.5 * cos(f * 10.0 + t * 0.2 * 3.14159 + vec3(0.0, 2.0, 4.0));
    
    // Specular
    float spec = smoothstep(0.4, 0.5, f) - smoothstep(0.5, 0.6, f);
    col += vec3(spec);
    return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord.xy / iResolution.xy) * 2.0 - 1.0;
    uv.x *= iResolution.x / iResolution.y;
    float t = mod(iTime, 10.0);
    
    vec3 col1 = getPlastic(uv, t);
    vec3 col2 = getPlastic(uv, t - 10.0);
    
    // Linear blend
    vec3 col = mix(col1, col2, t / 10.0);

    fragColor = vec4(col, 1.0);
}
`;