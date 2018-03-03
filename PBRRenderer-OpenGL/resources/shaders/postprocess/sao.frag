#version 430 core

out float saoOutput;
in vec2 TexCoords;

int saoQ = 4;
float PI  = 3.14159265359f;
float saoEpsilon = 0.01f;

uniform sampler2D gPosition;
uniform sampler2D gNormal;

uniform int viewportWidth;
uniform int viewportHeight;
uniform int saoSamples;
uniform int saoTurns;
uniform float saoRadius;
uniform float saoBias;
uniform float saoScale;
uniform float saoContrast;


void main()
{
	//通过G-Buffer得到位置和法线信息
    vec3 fragPos = texture(gPosition, TexCoords).xyz;
    vec3 normal = normalize(texture(gNormal, TexCoords).rgb);

    float saoOcclusion = 0.0f;

    // 
    ivec2 saoOffset = ivec2(gl_FragCoord.xy);
    float saoPhi = (30 * saoOffset.x ^ saoOffset.y + 10 * saoOffset.x * saoOffset.y);

    const float saoScreenRadius = -saoRadius * 3500.0f / fragPos.z;
	//textureQueryLevels返回最大的mipmap计算数目
    int saoMaxMipLevel = textureQueryLevels(gPosition) - 1;

    for (int i = 0; i < saoSamples; ++i)
    {
		//确定采样点离采样中心的距离
        float saoAlpha = 1.0f / saoSamples * (i + 0.5f);
        float saoH = saoScreenRadius * saoAlpha;
		
		//获得采样点的方向向量
        float saoTetha = 2.0f * PI * saoAlpha * saoTurns + saoPhi;
        vec2 saoU = vec2(cos(saoTetha), sin(saoTetha));

		//获得真正的采样点
		//findMSB找到转化为二进制后第一个有效数字1的索引位置
        int saoM = clamp(findMSB(int(saoH)) - 4, 0, saoMaxMipLevel);
		//texelFetch从纹理贴图中查找单个纹理的值
        vec3 saoSampleOffset = texelFetch(gPosition, ivec2(saoH * saoU + saoOffset) >> saoM, saoM).xyz;
        vec3 saoV = saoSampleOffset - fragPos;

        //计算遮蔽因子-公式
        saoOcclusion += max(0.0f, dot(saoV, normal) + (fragPos.z * saoBias)) / (dot(saoV, saoV) + saoEpsilon);
    }

	//公式
    saoOcclusion = max(0, 1.0f - 2.0f * saoScale / saoSamples * saoOcclusion);
    saoOcclusion = pow(saoOcclusion, saoContrast);

    saoOutput = saoOcclusion;
}
