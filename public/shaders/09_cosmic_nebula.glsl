const shader = `
precision highp float;

float hash(vec3 p) {
    p = fract(p * 0.3183099 + .1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(in vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}

float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

vec3 getNebula(vec2 uv, float t) {
    vec3 p = vec3(uv * 2.0, t * 0.2);
    float n = fbm(p);
    
    // Second layer
    float n2 = fbm(p * 2.0 + vec3(2.0));
    
    vec3 col = vec3(0.1, 0.0, 0.3); // Base dark purple
    
    // Mix nebula colors
    col = mix(col, vec3(0.0, 0.5, 0.8), n);
    col = mix(col, vec3(0.8, 0.2, 0.5), n2 * n);
    
    // Stars
    float s = noise(vec3(uv * 100.0, 1.0)); 
    if (s > 0.98) col += vec3(s);
    
    return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
    float t = mod(iTime, 10.0);
    
    vec3 c1 = getNebula(uv, t);
    vec3 c2 = getNebula(uv, t - 10.0);
    
    vec3 col = mix(c1, c2, t / 10.0);
    
    // Vignette
    col *= 1.0 - length(uv) * 0.5;

    fragColor = vec4(col, 1.0);
}
`;