#version 400 core

in vec2 TexCoords;

out vec4 sssBlurOutput;

uniform sampler2D sssInput;

uniform sampler2D colorInput;

uniform int sssBlurSize;

uniform bool OpenSSSBlur;


void main()
{
	if (OpenSSSBlur)
	{
		vec2 texelSize = 1.0 / vec2(textureSize(sssInput, 0));
		vec3 result = vec3(0.0f, 0.0f, 0.0f);

		float gaussainBlur[5];
		gaussainBlur[0] = 0.0545;
		gaussainBlur[1] = 0.2442;
		gaussainBlur[2] = 0.4026;
		gaussainBlur[3] = 0.2442;
		gaussainBlur[4] = 0.0545;

		for (int x = -2; x <= 2; ++x)
		{
			for (int y = -2; y <= 2; ++y)
			{
				vec2 offset = vec2(float(x), float(y)) * texelSize * sssBlurSize;
				result += texture(sssInput, TexCoords + offset).rgb * gaussainBlur[x + 2] * gaussainBlur[y + 2];
			}
		}
		sssBlurOutput = vec4(result + texture(colorInput, TexCoords).rgb, 1.0f);
	}
	else
	{
		sssBlurOutput = vec4(texture(colorInput, TexCoords).rgb, 1.0f);
	}
}
