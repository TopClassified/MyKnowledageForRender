#version 400 core

in vec3 cubeCoords;
out vec4 colorOutput;


const float PI = 3.14159265359f;
const uint numSamples = 1024u;

uniform float roughness;
uniform float cubeResolutionWidth;
uniform float cubeResolutionHeight;
uniform samplerCube envMap;

float saturate(float f)
{
    return clamp(f, 0.0f, 1.0f);
}

//有效的 VanDerCorpus 计算.
//VanDerCorpus序列式为1/2，1/4，3/4，1/8，5/8，7/8 
//二进制情况下即为：0.1，0.01，0.11，0.001，0.101
float radicalInverse_VdC(uint bits) // In place of bitfieldreverse()
{
    bits = (bits << 16u) | (bits >> 16u);
    bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
    bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
    bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
    bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);

    return float(bits) * 2.3283064365386963e-10;
}

//Hammersley随机二维向量
vec2 computeHammersley(uint i, uint N)
{
    return vec2(float(i)/float(N), radicalInverse_VdC(i));
}

//重要性采样
vec3 computeImportanceSampleGGX(vec2 Xi, float roughness, vec3 N)
{
    float alpha = roughness * roughness;

    float anglePhi = 2 * PI * Xi.x;												  //水平方向
    float cosTheta = sqrt((1.0f - Xi.y) / (1.0f + (alpha * alpha - 1.0f) * Xi.y));//竖直方向
    float sinTheta = sqrt(1.0f - cosTheta * cosTheta);

    vec3 H;
    H.x = sinTheta * cos(anglePhi);
    H.y = sinTheta * sin(anglePhi);
    H.z = cosTheta;

    vec3 upDir = abs(N.z) < 0.999f ? vec3(0.0f, 0.0f, 1.0f) : vec3(1.0f, 0.0f, 0.0f);
    vec3 tanX = normalize(cross(upDir, N));
    vec3 tanY = cross(N, tanX);

    return normalize(tanX * H.x + tanY * H.y + N * H.z);
}

//微平面分布函数
float computeDistributionGGX(vec3 N, vec3 H, float roughness)
{
    float alpha = roughness * roughness;
    float alpha2 = alpha * alpha;

    float NdotH = saturate(dot(N, H));
    float NdotH2 = NdotH * NdotH;

    return (alpha2) / (PI * (NdotH2 * (alpha2 - 1.0f) + 1.0f) * (NdotH2 * (alpha2 - 1.0f) + 1.0f));
}


void main()
{
    vec3 N = normalize(cubeCoords);

    // UE4引擎使用的一个优化近似模拟，假设V=R=法线 
    vec3 R = N;
    vec3 V = R;

    vec3 prefilteredAccumulation = vec3(0.0f);
    float totalSampleWeight = 0.0f;

    for(uint i = 0u; i < numSamples; ++i)
    {
        // 使用Hammersley函数生成一个样本向量
        vec2 Xi = computeHammersley(i, numSamples);
		//根据样本向量进行重要性采样得到半程向量
        vec3 H = computeImportanceSampleGGX(Xi, roughness, N);
		//根据半程向量计算得到入射光向量
        vec3 L = normalize(2.0f * dot(V, H) * H - V);

		//入射向量与法线的夹角，即入射光线的强度
        float NdotL = max(dot(N, L), 0.0f);

        if(NdotL > 0.0f)
        {
			//微平面分布值
            float D = computeDistributionGGX(N, H, roughness);
            //法线与半程向量点乘得到镜面反射后的光线强度
			float NdotH = max(dot(N, H), 0.0f);
            float HdotV = max(dot(H, V), 0.0f);
			//求得能够抽取到该采样向量的概率值
            float probaDistribFunction = D * NdotH / (4.0f * HdotV) + 0.0001f;

            //通过采样不同的mip等级的环境贴图来代替直接采样环境贴图避免出现一些噪点
			//4PI是单位球体的球面度，除以贴图像素数量后得到单位像素对应的球面度大小
            float saTexel  = 4.0f * PI / (6.0f * cubeResolutionWidth * cubeResolutionHeight);
			//抽取该采样向量的总次数的倒数
            float saSample = 1.0f / (float(numSamples) * probaDistribFunction + 0.0001f);
			//计算出mip等级
            float mipLevel = roughness == 0.0f ? 0.0f : 0.5f * log2(saSample / saTexel);
			//根据入射光线和mip等级在环境贴图中采样
            prefilteredAccumulation += textureLod(envMap, L, mipLevel).rgb * NdotL;
			//采样的权重
            totalSampleWeight += NdotL;
        }
    }
	//得到平均值
    prefilteredAccumulation = prefilteredAccumulation / totalSampleWeight;

    colorOutput = vec4(prefilteredAccumulation, 1.0f);
}
