#version 400 core

in vec2 TexCoords;
in vec3 envMapCoords;
out vec4 colorOutput;

in mat4 LightSpaceMatrix;

const float PI = 3.14159265359f;
const float prefilterLODLevel = 4.0f;

// Light source(s) informations
struct LightObject
{
    vec3 position;
    vec3 direction;
    vec4 color;
    float radius;
};

uniform int lightPointCounter = 3;
uniform int lightDirectionalCounter = 1;
uniform LightObject lightPointArray[3];
uniform LightObject lightDirectionalArray[1];

// G-Buffer
uniform sampler2D gPosition;
uniform sampler2D gAlbedo;
uniform sampler2D gNormal;
uniform sampler2D gEffects;

uniform sampler2D sao;
uniform sampler2D envMap;
uniform samplerCube envMapIrradiance;
uniform samplerCube envMapPrefilter;
uniform sampler2D envMapLUT;

//��Ӱ��ͼ
uniform sampler2D ShadowMap;
uniform sampler2D worldPos;
uniform sampler2D worldNormal;

uniform int gBufferView;
uniform bool pointMode;
uniform bool directionalMode;
uniform bool iblMode;
uniform int attenuationMode;
uniform vec3 materialF0;

uniform mat4 view;


vec3 colorLinear(vec3 colorVector)
{
    vec3 linearColor = pow(colorVector.rgb, vec3(2.2f));

    return linearColor;
}


float saturate(float f)
{
    return clamp(f, 0.0f, 1.0f);
}


vec2 getSphericalCoord(vec3 normalCoord)
{
    float phi = acos(-normalCoord.y);
    float theta = atan(1.0f * normalCoord.x, -normalCoord.z) + PI;

    return vec2(theta / (2.0f * PI), phi / PI);
}


float Fd90(float NoL, float roughness)
{
    return (2.0f * NoL * roughness) + 0.4f;
}


float KDisneyTerm(float NoL, float NoV, float roughness)
{
    return (1.0f + Fd90(NoL, roughness) * pow(1.0f - NoL, 5.0f)) * (1.0f + Fd90(NoV, roughness) * pow(1.0f - NoV, 5.0f));
}

//������ϵ��
vec3 computeFresnelSchlick(float NdotV, vec3 F0)
{
    return F0 + (1.0f - F0) * pow(1.0f - NdotV, 5.0f);
}

//�ֲڶȡ���������ϵ��
vec3 computeFresnelSchlickRoughness(float NdotV, vec3 F0, float roughness)
{
    return F0 + (max(vec3(1.0f - roughness), F0) - F0) * pow(1.0f - NdotV, 5.0f);
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

//�����ڱκ���
float computeGeometryAttenuationGGXSmith(float NdotL, float NdotV, float roughness)
{
    float NdotL2 = NdotL * NdotL;
    float NdotV2 = NdotV * NdotV;
    float kRough2 = roughness * roughness + 0.0001f;

    float ggxL = (2.0f * NdotL) / (NdotL + sqrt(NdotL2 + kRough2 * (1.0f - NdotL2)));
    float ggxV = (2.0f * NdotV) / (NdotV + sqrt(NdotV2 + kRough2 * (1.0f - NdotV2)));

    return ggxL * ggxV;
}

float ShadowCalculation(vec4 fragPosLightSpace, vec3 Normal, vec3 lightPos, vec3 FragPos)
{
    // ִ��͸�ӳ���
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;

    // �任��[0,1]�ķ�Χ
    projCoords = projCoords * 0.5 + 0.5;

    // ȡ�����������(ʹ��[0,1]��Χ�µ�fragPosLight������)
    float closestDepth = texture(ShadowMap, projCoords.xy).r; 

    //ȡ�õ�ǰƬԪ�ڹ�Դ�ӽ��µ����
    float currentDepth = projCoords.z;

    // ������Ӱƫ��
    vec3 normal = normalize(Normal);
    vec3 lightDir = normalize(lightPos - FragPos);
    float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.005);

    // ��鵱ǰƬԪ�Ƿ�����Ӱ��
    float shadow = currentDepth - bias > closestDepth  ? 1.0 : 0.0;
    
	// ʹ��PCF
    shadow = 0.0;
    vec2 texelSize = 1.0 / textureSize(ShadowMap, 0);
    for(int x = -1; x <= 1; ++x)
    {
        for(int y = -1; y <= 1; ++y)
        {
            float pcfDepth = texture(ShadowMap, projCoords.xy + vec2(x, y) * texelSize).r; 
            shadow += currentDepth - bias > pcfDepth  ? 1.0 : 0.0;        
        }    
    }
    shadow /= 9.0;
    
    // �ڽ�Զ������ʹshadowΪ0����ֹ���ֶ������Ӱ
    if(projCoords.z > 1.0)
        shadow = 0.0;
        
    return shadow;
}

void main()
{
    // ��G-Buffer�л�����������Ϣ
    vec3 viewPos = texture(gPosition, TexCoords).rgb;
	vec4 Shadow_ViewPos = texture(gPosition, TexCoords);
    vec3 albedo = colorLinear(texture(gAlbedo, TexCoords).rgb);
    vec3 normal = texture(gNormal, TexCoords).rgb;
    float roughness = texture(gAlbedo, TexCoords).a;
    float metalness = texture(gNormal, TexCoords).a;
    float ao = texture(gEffects, TexCoords).r;
    vec2 velocity = texture(gEffects, TexCoords).gb;
    float depth = texture(gPosition, TexCoords).a;

	vec4 WorldPos = texture(worldPos, TexCoords);
	vec3 WorldNormal = texture(worldNormal, TexCoords).rgb;

	//�����������ڱ���ͼ
    float sao = texture(sao, TexCoords).r;
	//��HDR������ͼ����
    vec3 envColor = texture(envMap, getSphericalCoord(normalize(envMapCoords))).rgb;

	//��ʼ�������⡢������⡢���淴���
    vec3 color = vec3(0.0f);
    vec3 diffuse = vec3(0.0f);
    vec3 specular = vec3(0.0f);


    if(depth == 1.0f)
    {
        color = envColor;
    }
    else
    {
		//�۲�����
        vec3 V = normalize(-viewPos);
		//��������
        vec3 N = normalize(normal);
		//��������
        //vec3 R = refract(-V, N, 0.75f);
	    vec3 R = reflect(-V, N);
		
        float NdotV = max(dot(N, V), 0.0001f);

        // ���������ϵ��
        vec3 F0 = mix(materialF0, albedo, metalness);
        vec3 F = computeFresnelSchlick(NdotV, F0);

        // ���㷴�����������յ�����
        vec3 kS = F;
        vec3 kD = vec3(1.0f) - kS;
        kD *= 1.0f - metalness;

		float shadow = 0.0f;

		//��ʼ�������
        if (pointMode)
        {
            //ö�����еĵ��Դ
            for (int i = 0; i < lightPointCounter; i++)
            {
				//���������
                vec3 L = normalize(lightPointArray[i].position - viewPos);
				//�������
                vec3 H = normalize(L + V);

				//��������ɫ���Ի�
                vec3 lightColor = colorLinear(lightPointArray[i].color.rgb);
				//��ù�Դ��õ�ľ���
                float distanceL = length(lightPointArray[i].position - viewPos);
                float attenuation;

				//���ݲ�ͬ��˥��ģʽ����˥��ϵ��
                if(attenuationMode == 1)
                    attenuation = 1.0f / (distanceL * distanceL); // �����ľ���ƽ��˥����ʽ
                else if(attenuationMode == 2)
                    attenuation = pow(saturate(1 - pow(distanceL / lightPointArray[i].radius, 4)), 2) / (distanceL * distanceL + 1); // UE4����ʹ�õ�˥����ʽ

                // ���������뷨�ߵļн�
                float NdotL = saturate(dot(N, L));

                // �õ�˥����Ĺ�����ɫ
                vec3 kRadiance = lightColor * attenuation;

                // �����䲿�ֵĹ��ս��
                diffuse = albedo / PI;

                // ��ʿ��������
                float kDisney = KDisneyTerm(NdotL, NdotV, roughness);

                // ����΢ƽ��ֲ�ϵ��
                float D = computeDistributionGGX(N, H, roughness);

                // ���㼸���ڱ�ϵ��
                float G = computeGeometryAttenuationGGXSmith(NdotL, NdotV, roughness);

                // ���淴����ս��
                specular = (F * D * G) / (4.0f * NdotL * NdotV + 0.0001f);

				//���յĹ��ս����diffuse�����滻��kDisney��
                color += (diffuse * kD + specular) * kRadiance * NdotL;
            }
        }

        if (directionalMode)
        {
            for (int i = 0; i < lightDirectionalCounter; i++)
            {
				shadow = ShadowCalculation( LightSpaceMatrix * vec4(vec3(WorldPos), 1.0f), WorldNormal, lightDirectionalArray[i].direction * -3.0f, vec3(WorldPos) );                      
				shadow = min(shadow, 0.9);

                vec3 L = normalize(- lightDirectionalArray[i].direction);
                vec3 H = normalize(L + V);

                vec3 lightColor = colorLinear(lightDirectionalArray[i].color.rgb);

                float NdotL = saturate(dot(N, L));

                // ������
                diffuse = albedo / PI;

                // ��ʿ��������
                float kDisney = KDisneyTerm(NdotL, NdotV, roughness);

                // ΢ƽ��ֲ�ϵ��
                float D = computeDistributionGGX(N, H, roughness);

                // �����ڱ�ϵ��
                float G = computeGeometryAttenuationGGXSmith(NdotL, NdotV, roughness);

                // ���淴��
                specular = (F * D * G) / (4.0f * NdotL * NdotV + 0.0001f);

                color += (diffuse * kD + specular) * lightColor * NdotL * (1.0f - shadow);
            }
        }

        if (iblMode)
        {
			//���ն��㷨�������ݴֲڶȼ��������ϵ��
            F = computeFresnelSchlickRoughness(NdotV, F0, roughness);

            kS = F;
            kD = vec3(1.0f) - kS;
            kD *= 1.0f - metalness;

            // �ӻ�����ͼ�в���������ķ��ս��
            vec3 diffuseIrradiance = texture(envMapIrradiance, N * mat3(view)).rgb;
            diffuseIrradiance *= albedo;

            // ��Ԥ������ͼ�в�����ɫ
            vec3 specularRadiance = textureLod(envMapPrefilter, R * mat3(view), roughness * prefilterLODLevel).rgb;
			//��˫����ֺ�����ͼ�в���ϵ��
            vec2 brdfSampling = texture(envMapLUT, vec2(NdotV, roughness)).rg;
            specularRadiance *= F * brdfSampling.x + brdfSampling.y;

            vec3 ambientIBL = (diffuseIrradiance * kD) + specularRadiance;

            color += ambientIBL;
        }
		//��Ҫ���ǳ��Ϲ��ڱ���ͼ
        color *= ao;
    }

    // ѡ����Ҫ�鿴�Ļ���
    // ���ս������
    if(gBufferView == 1)
        colorOutput = vec4(color, 1.0f);
    // λ�û���
    else if (gBufferView == 2)
        colorOutput = vec4(viewPos, 1.0f);
    // ����ռ䷨�߻���
    else if (gBufferView == 3)
        colorOutput = vec4(normal, 1.0f);
    // ���ڱλ���
    else if (gBufferView == 4)
        colorOutput = vec4(albedo, 1.0f);
    // �ֲڶȻ���
    else if (gBufferView == 5)
        colorOutput = vec4(vec3(roughness), 1.0f);
    // �����Ȼ���
    else if (gBufferView == 6)
        colorOutput = vec4(vec3(metalness), 1.0f);
    // ��Ȼ���
    else if (gBufferView == 7)
        colorOutput = vec4(vec3(depth/1000.0f), 1.0f);
    // �������ڱλ���
    else if (gBufferView == 8)
        colorOutput = vec4(vec3(sao), 1.0f);
    else if (gBufferView == 9)
        colorOutput = vec4(velocity, 0.0f, 1.0f);
}
