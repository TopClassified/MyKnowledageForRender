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

//��Ч�� VanDerCorpus ����.
//VanDerCorpus����ʽΪ1/2��1/4��3/4��1/8��5/8��7/8 
//����������¼�Ϊ��0.1��0.01��0.11��0.001��0.101
float radicalInverse_VdC(uint bits) // In place of bitfieldreverse()
{
    bits = (bits << 16u) | (bits >> 16u);
    bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
    bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
    bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
    bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);

    return float(bits) * 2.3283064365386963e-10;
}

//Hammersley�����ά����
vec2 computeHammersley(uint i, uint N)
{
    return vec2(float(i)/float(N), radicalInverse_VdC(i));
}

//��Ҫ�Բ���
vec3 computeImportanceSampleGGX(vec2 Xi, float roughness, vec3 N)
{
    float alpha = roughness * roughness;

    float anglePhi = 2 * PI * Xi.x;												  //ˮƽ����
    float cosTheta = sqrt((1.0f - Xi.y) / (1.0f + (alpha * alpha - 1.0f) * Xi.y));//��ֱ����
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

//΢ƽ��ֲ�����
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

    // UE4����ʹ�õ�һ���Ż�����ģ�⣬����V=R=���� 
    vec3 R = N;
    vec3 V = R;

    vec3 prefilteredAccumulation = vec3(0.0f);
    float totalSampleWeight = 0.0f;

    for(uint i = 0u; i < numSamples; ++i)
    {
        // ʹ��Hammersley��������һ����������
        vec2 Xi = computeHammersley(i, numSamples);
		//������������������Ҫ�Բ����õ��������
        vec3 H = computeImportanceSampleGGX(Xi, roughness, N);
		//���ݰ����������õ����������
        vec3 L = normalize(2.0f * dot(V, H) * H - V);

		//���������뷨�ߵļнǣ���������ߵ�ǿ��
        float NdotL = max(dot(N, L), 0.0f);

        if(NdotL > 0.0f)
        {
			//΢ƽ��ֲ�ֵ
            float D = computeDistributionGGX(N, H, roughness);
            //��������������˵õ����淴���Ĺ���ǿ��
			float NdotH = max(dot(N, H), 0.0f);
            float HdotV = max(dot(H, V), 0.0f);
			//����ܹ���ȡ���ò��������ĸ���ֵ
            float probaDistribFunction = D * NdotH / (4.0f * HdotV) + 0.0001f;

            //ͨ��������ͬ��mip�ȼ��Ļ�����ͼ������ֱ�Ӳ���������ͼ�������һЩ���
			//4PI�ǵ�λ���������ȣ�������ͼ����������õ���λ���ض�Ӧ������ȴ�С
            float saTexel  = 4.0f * PI / (6.0f * cubeResolutionWidth * cubeResolutionHeight);
			//��ȡ�ò����������ܴ����ĵ���
            float saSample = 1.0f / (float(numSamples) * probaDistribFunction + 0.0001f);
			//�����mip�ȼ�
            float mipLevel = roughness == 0.0f ? 0.0f : 0.5f * log2(saSample / saTexel);
			//����������ߺ�mip�ȼ��ڻ�����ͼ�в���
            prefilteredAccumulation += textureLod(envMap, L, mipLevel).rgb * NdotL;
			//������Ȩ��
            totalSampleWeight += NdotL;
        }
    }
	//�õ�ƽ��ֵ
    prefilteredAccumulation = prefilteredAccumulation / totalSampleWeight;

    colorOutput = vec4(prefilteredAccumulation, 1.0f);
}
