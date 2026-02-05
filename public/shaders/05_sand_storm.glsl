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

float getPattern(vec2 uv, float t) {
    float n = 0.0;
    vec3 p = vec3(uv * 5.0, t * 2.0);
    n += noise(p);
    n += noise(p * 2.0 + vec3(0.0, 0.0, t)) * 0.5;
    n += noise(p * 4.0 - vec3(0.0, 0.0, t * 2.0)) * 0.25;
    return n;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
    float t = mod(iTime, 10.0);
    
    // Loop by blending two time offsets
    // t goes 0 -> 10.
    // We blend Pattern(t) and Pattern(t - 10.0) using t/10.0 as weight?
    // At t=0: mix(P(0), P(-10), 0) = P(0)
    // At t=10: mix(P(10), P(0), 1) = P(0)
    // Note: P(10) is not necessarily P(0) in non-periodic noise.
    // But P(t-10) at t=10 is P(0).
    // So yes, this works.
    
    float n1 = getPattern(uv, t);
    float n2 = getPattern(uv, t - 10.0);
    
    float n = mix(n1, n2, t / 10.0);
    
    n = pow(n, 3.0) * 2.0; // Contrast
    
    // Depth effect vignette
    float v = 1.0 - length(uv) * 0.8;
    n *= v;

    fragColor = vec4(vec3(n), 1.0);
}
`;