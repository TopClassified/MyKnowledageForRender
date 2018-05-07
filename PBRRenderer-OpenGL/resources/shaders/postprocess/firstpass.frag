#version 400 core

in vec2 TexCoords;
out vec4 colorOutput;

float FXAA_SPAN_MAX = 8.0f;
float FXAA_REDUCE_MUL = 1.0f/8.0f;
float FXAA_REDUCE_MIN = 1.0f/128.0f;
float middleGrey = 0.18f;

uniform sampler2D screenTexture;
uniform sampler2D sao;
uniform sampler2D gEffects;

uniform int gBufferView;
uniform int motionBlurMaxSamples;
uniform int tonemappingMode;
uniform bool saoMode;
uniform bool fxaaMode;
uniform bool motionBlurMode;
uniform float cameraAperture;
uniform float cameraShutterSpeed;
uniform float cameraISO;
uniform float motionBlurScale;
uniform vec2 screenTextureSize;

//详见http://www.geeks3d.com/20110405/fxaa-fast-approximate-anti-aliasing-demo-glsl-opengl-test-radeon-geforce/3/
vec3 computeFxaa()
{
    vec2 screenTextureOffset = screenTextureSize;

	//与RGB的三个分量对应相乘后得到亮度
    vec3 luma = vec3(0.299f, 0.587f, 0.114f);

	//分别采样左上、右上、左下、右下以及自身的像素颜色。
    vec3 offsetNW = texture(screenTexture, TexCoords.xy + (vec2(-1.0f, -1.0f) * screenTextureOffset)).xyz;
    vec3 offsetNE = texture(screenTexture, TexCoords.xy + (vec2(1.0f, -1.0f) * screenTextureOffset)).xyz;
    vec3 offsetSW = texture(screenTexture, TexCoords.xy + (vec2(-1.0f, 1.0f) * screenTextureOffset)).xyz;
    vec3 offsetSE = texture(screenTexture, TexCoords.xy + (vec2(1.0f, 1.0f) * screenTextureOffset)).xyz;
    vec3 offsetM  = texture(screenTexture, TexCoords.xy).xyz;

	//计算亮度
    float lumaNW = dot(luma, offsetNW);
    float lumaNE = dot(luma, offsetNE);
    float lumaSW = dot(luma, offsetSW);
    float lumaSE = dot(luma, offsetSE);
    float lumaM  = dot(luma, offsetNW);

	//计算边缘线的方向
    vec2 dir = vec2(-((lumaNW + lumaNE) - (lumaSW + lumaSE)), ((lumaNW + lumaSW) - (lumaNE + lumaSE)));

	//计算真正的方向
    float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * (FXAA_REDUCE_MUL * 0.25f), FXAA_REDUCE_MIN);
    float dirCorrection = 1.0f / (min(abs(dir.x), abs(dir.y)) + dirReduce);

	//计算最终的采样位移，FXAA_SPAN_MAX限制位移量不能超过8个像素
    dir = min(vec2(FXAA_SPAN_MAX), max(vec2(-FXAA_SPAN_MAX), dir * dirCorrection)) * screenTextureOffset;

    vec3 resultA = 0.5f * (texture(screenTexture, TexCoords.xy + (dir * vec2(1.0f / 3.0f - 0.5f))).xyz + texture(screenTexture, TexCoords.xy + (dir * vec2(2.0f / 3.0f - 0.5f))).xyz);

    vec3 resultB = resultA * 0.5f + 0.25f * (texture(screenTexture, TexCoords.xy + (dir * vec2(0.0f / 3.0f - 0.5f))).xyz + texture(screenTexture, TexCoords.xy + (dir * vec2(3.0f / 3.0f - 0.5f))).xyz);

    float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
    float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));
    float lumaResultB = dot(luma, resultB);

    if(lumaResultB < lumaMin || lumaResultB > lumaMax)
        return vec3(resultA);
    else
        return vec3(resultB);
}

vec3 computeMotionBlur(vec3 colorVector)
{
    vec2 texelSize = 1.0f / vec2(textureSize(screenTexture, 0));

    vec2 velocity = texture(gEffects, TexCoords).gb;
    velocity *= motionBlurScale;

    float fragSpeed = length(velocity / texelSize);
    int numSamples = clamp(int(fragSpeed), 1, motionBlurMaxSamples);

    for (int i = 1; i < numSamples; ++i)
    {
        vec2 blurOffset = velocity * (float(i) / float(numSamples - 1) - 0.5f);
        colorVector += texture(screenTexture, TexCoords + blurOffset).rgb;
    }

    return colorVector /= float(numSamples);
}


vec3 colorLinear(vec3 colorVector)
{
  vec3 linearColor = pow(colorVector.rgb, vec3(2.2f));

  return linearColor;
}


vec3 colorSRGB(vec3 colorVector)
{
  vec3 srgbColor = pow(colorVector.rgb, vec3(1.0f / 2.2f));

  return srgbColor;
}


vec3 ReinhardTM(vec3 color)
{
    return color / (color + vec3(1.0f));
}


vec3 FilmicTM(vec3 color)
{
    color = max(vec3(0.0f), color - vec3(0.004f));
    color = (color * (6.2f * color + 0.5f)) / (color * (6.2f * color + 1.7f) + 0.06f);

    return color;
}


vec3 UnchartedTM(vec3 color)
{
  const float A = 0.15f;
  const float B = 0.50f;
  const float C = 0.10f;
  const float D = 0.20f;
  const float E = 0.02f;
  const float F = 0.30f;
  const float W = 11.2f;

  color = ((color * (A * color + C * B) + D * E) / (color * ( A * color + B) + D * F)) - E / F;

  return color;
}


float computeSOBExposure(float aperture, float shutterSpeed, float iso)
{
    float lAvg = (1000.0f / 65.0f) * sqrt(aperture) / (iso * shutterSpeed);

    return middleGrey / lAvg;
}


void main()
{
    vec3 color;

    if(gBufferView == 1)
    {
        // FXAA抗锯齿
        if(fxaaMode)
            color = computeFxaa(); 
        else
            color = texture(screenTexture, TexCoords).rgb;

        // 动态模糊
        if(motionBlurMode)
            color = computeMotionBlur(color);

        // 环境光遮蔽
        if(saoMode)
        {
            float sao = texture(sao, TexCoords).r;
            color *= sao;
        }

        // 曝光
        color *= computeSOBExposure(cameraAperture, cameraShutterSpeed, cameraISO);

        if(tonemappingMode == 1)
        {
            color = ReinhardTM(color);
            colorOutput = vec4(colorSRGB(color), 1.0f);
        }
        else if(tonemappingMode == 2)
        {
            color = FilmicTM(color);
            colorOutput = vec4(color, 1.0f);
        }
        else if(tonemappingMode == 3)
        {
            float W = 11.2f;
            color = UnchartedTM(color);
            vec3 whiteScale = 1.0f / UnchartedTM(vec3(W));

            color *= whiteScale;
            colorOutput = vec4(colorSRGB(color), 1.0f);
        }
    }
    else    
    {
        color = texture(screenTexture, TexCoords).rgb;
        colorOutput = vec4(color, 1.0f);
    }
}