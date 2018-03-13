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

//阴影贴图
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

//菲涅尔系数
vec3 computeFresnelSchlick(float NdotV, vec3 F0)
{
    return F0 + (1.0f - F0) * pow(1.0f - NdotV, 5.0f);
}

//粗糙度——菲涅尔系数
vec3 computeFresnelSchlickRoughness(float NdotV, vec3 F0, float roughness)
{
    return F0 + (max(vec3(1.0f - roughness), F0) - F0) * pow(1.0f - NdotV, 5.0f);
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

//几何遮蔽函数
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
    // 执行透视除法
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;

    // 变换到[0,1]的范围
    projCoords = projCoords * 0.5 + 0.5;

    // 取得最近点的深度(使用[0,1]范围下的fragPosLight当坐标)
    float closestDepth = texture(ShadowMap, projCoords.xy).r; 

    //取得当前片元在光源视角下的深度
    float currentDepth = projCoords.z;

    // 计算阴影偏移
    vec3 normal = normalize(Normal);
    vec3 lightDir = normalize(lightPos - FragPos);
    float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.005);

    // 检查当前片元是否在阴影中
    float shadow = currentDepth - bias > closestDepth  ? 1.0 : 0.0;
    
	// 使用PCF
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
    
    // 在较远的区域使shadow为0，防止出现多余的阴影
    if(projCoords.z > 1.0)
        shadow = 0.0;
        
    return shadow;
}

void main()
{
    // 从G-Buffer中获得所有相关信息
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

	//采样环境光遮蔽贴图
    float sao = texture(sao, TexCoords).r;
	//从HDR环境贴图采样
    vec3 envColor = texture(envMap, getSphericalCoord(normalize(envMapCoords))).rgb;

	//初始化基础光、漫反射光、镜面反射光
    vec3 color = vec3(0.0f);
    vec3 diffuse = vec3(0.0f);
    vec3 specular = vec3(0.0f);


    if(depth == 1.0f)
    {
        color = envColor;
    }
    else
    {
		//观察向量
        vec3 V = normalize(-viewPos);
		//法线向量
        vec3 N = normalize(normal);
		//反射向量
        //vec3 R = refract(-V, N, 0.75f);
	    vec3 R = reflect(-V, N);
		
        float NdotV = max(dot(N, V), 0.0001f);

        // 计算菲涅尔系数
        vec3 F0 = mix(materialF0, albedo, metalness);
        vec3 F = computeFresnelSchlick(NdotV, F0);

        // 计算反射能量和吸收的能量
        vec3 kS = F;
        vec3 kD = vec3(1.0f) - kS;
        kD *= 1.0f - metalness;

		float shadow = 0.0f;

		//开始计算光照
        if (pointMode)
        {
            //枚举所有的点光源
            for (int i = 0; i < lightPointCounter; i++)
            {
				//入射光向量
                vec3 L = normalize(lightPointArray[i].position - viewPos);
				//半程向量
                vec3 H = normalize(L + V);

				//将光照颜色线性化
                vec3 lightColor = colorLinear(lightPointArray[i].color.rgb);
				//获得光源与该点的距离
                float distanceL = length(lightPointArray[i].position - viewPos);
                float attenuation;

				//根据不同的衰减模式计算衰减系数
                if(attenuationMode == 1)
                    attenuation = 1.0f / (distanceL * distanceL); // 常见的距离平方衰减方式
                else if(attenuationMode == 2)
                    attenuation = pow(saturate(1 - pow(distanceL / lightPointArray[i].radius, 4)), 2) / (distanceL * distanceL + 1); // UE4引擎使用的衰减方式

                // 获得入射光与法线的夹角
                float NdotL = saturate(dot(N, L));

                // 得到衰减后的光照颜色
                vec3 kRadiance = lightColor * attenuation;

                // 漫反射部分的光照结果
                diffuse = albedo / PI;

                // 迪士尼漫反射
                float kDisney = KDisneyTerm(NdotL, NdotV, roughness);

                // 计算微平面分布系数
                float D = computeDistributionGGX(N, H, roughness);

                // 计算几何遮蔽系数
                float G = computeGeometryAttenuationGGXSmith(NdotL, NdotV, roughness);

                // 镜面反射光照结果
                specular = (F * D * G) / (4.0f * NdotL * NdotV + 0.0001f);

				//最终的光照结果（diffuse可以替换成kDisney）
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

                // 漫反射
                diffuse = albedo / PI;

                // 迪士尼漫反射
                float kDisney = KDisneyTerm(NdotL, NdotV, roughness);

                // 微平面分布系数
                float D = computeDistributionGGX(N, H, roughness);

                // 几何遮蔽系数
                float G = computeGeometryAttenuationGGXSmith(NdotL, NdotV, roughness);

                // 镜面反射
                specular = (F * D * G) / (4.0f * NdotL * NdotV + 0.0001f);

                color += (diffuse * kD + specular) * lightColor * NdotL * (1.0f - shadow);
            }
        }

        if (iblMode)
        {
			//辐照度算法——根据粗糙度计算菲涅尔系数
            F = computeFresnelSchlickRoughness(NdotV, F0, roughness);

            kS = F;
            kD = vec3(1.0f) - kS;
            kD *= 1.0f - metalness;

            // 从环境贴图中采样漫反射的辐照结果
            vec3 diffuseIrradiance = texture(envMapIrradiance, N * mat3(view)).rgb;
            diffuseIrradiance *= albedo;

            // 从预过滤贴图中采样颜色
            vec3 specularRadiance = textureLod(envMapPrefilter, R * mat3(view), roughness * prefilterLODLevel).rgb;
			//从双向反射分函数贴图中采样系数
            vec2 brdfSampling = texture(envMapLUT, vec2(NdotV, roughness)).rg;
            specularRadiance *= F * brdfSampling.x + brdfSampling.y;

            vec3 ambientIBL = (diffuseIrradiance * kD) + specularRadiance;

            color += ambientIBL;
        }
		//不要忘记乘上光遮蔽贴图
        color *= ao;
    }

    // 选择想要查看的缓存
    // 最终结果缓存
    if(gBufferView == 1)
        colorOutput = vec4(color, 1.0f);
    // 位置缓存
    else if (gBufferView == 2)
        colorOutput = vec4(viewPos, 1.0f);
    // 相机空间法线缓存
    else if (gBufferView == 3)
        colorOutput = vec4(normal, 1.0f);
    // 光遮蔽缓存
    else if (gBufferView == 4)
        colorOutput = vec4(albedo, 1.0f);
    // 粗糙度缓存
    else if (gBufferView == 5)
        colorOutput = vec4(vec3(roughness), 1.0f);
    // 金属度缓存
    else if (gBufferView == 6)
        colorOutput = vec4(vec3(metalness), 1.0f);
    // 深度缓存
    else if (gBufferView == 7)
        colorOutput = vec4(vec3(depth/1000.0f), 1.0f);
    // 环境光遮蔽缓存
    else if (gBufferView == 8)
        colorOutput = vec4(vec3(sao), 1.0f);
    else if (gBufferView == 9)
        colorOutput = vec4(velocity, 0.0f, 1.0f);
}
