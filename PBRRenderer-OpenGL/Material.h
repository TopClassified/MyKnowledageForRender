#ifndef MATERIAL_H
#define MATERIAL_H

#include <string>
#include <fstream>
#include <sstream>
#include <iostream>
#include <vector>
#include <tuple>

#include <GL/glew.h>

#include "Texture.h"
#include "Shader.h"


class Material
{
public:
	GLuint matID;
	Shader matShader;
	std::vector<std::tuple<std::string, Texture>> texList;

	Material();
	~Material();
	void addTexture(std::string uniformName, Texture texObj);
	void setShader(Shader& shader);
	void renderToShader();
};

#endif
