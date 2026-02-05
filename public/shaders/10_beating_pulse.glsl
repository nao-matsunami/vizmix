const shader = `
precision highp float;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
    float t = mod(iTime, 10.0);
    
    float r = length(uv);
    
    // Tunnel mapping
    // z represents depth or distance along the tunnel
    float z = 1.0 / (r + 0.01); // avoid div by zero
    
    // Moving texture along z
    // t * 10.0 -> t * 3.2 * PI (approx 10.05)
    float pulse = sin(z * 5.0 - t * 3.2 * 3.14159);
    
    vec3 col = vec3(0.9, 0.0, 0.1);
    
    // Sharp rings
    float ring = smoothstep(0.4, 0.6, pulse);
    col *= ring;
    
    // Fog / Depth fade
    // Center (far away) should be dark
    col *= r; 
    
    fragColor = vec4(col, 1.0);
}
`;