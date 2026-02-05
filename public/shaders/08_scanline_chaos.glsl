const shader = `
precision highp float;

float rand(vec2 co){
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord.xy / iResolution.xy;
    float t = mod(iTime, 10.0);
    
    // BPM 120 -> 2 beats per second -> 0.5 sec per beat
    float beat = floor(t * 4.0); // 4 times per second
    float beat_looped = mod(beat, 40.0); // Loop the beat index
    
    // Horizontal scanlines
    // t * 20.0 -> t * 6PI
    float h = step(0.5, sin(uv.y * 100.0 + t * 6.0 * 3.14159));
    
    // Vertical scanlines
    // t * 30.0 -> t * 10PI
    float v = step(0.9, sin(uv.x * 50.0 - t * 10.0 * 3.14159));
    
    // Chaos shift
    float shift = (rand(vec2(beat_looped, 0.0)) - 0.5) * 0.1;
    if (mod(beat, 2.0) == 0.0) uv.x += shift;
    
    // Looping random noise
    // Mix two noise samples
    float n1 = rand(uv * (t + 1.0));
    float n2 = rand(uv * (t - 9.0)); // t-10 + 1
    float noise = mix(n1, n2, t / 10.0);
    
    vec3 col = vec3(0.0);
    if (mod(beat, 3.0) == 0.0) {
        col = vec3(1.0, 0.0, 0.0) * h;
    } else {
        col = vec3(h + v) * noise;
    }
    
    // Flash
    col *= abs(sin(t * 2.0 * 3.14159));

    fragColor = vec4(col, 1.0);
}
`;