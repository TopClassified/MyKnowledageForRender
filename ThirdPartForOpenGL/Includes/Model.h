#pragma once
// Std. Includes
#include <string>
#include <fstream>
#include <sstream>
#include <iostream>
#include <map>
#include <vector>
using namespace std;
// GL Includes
#include <GL/glew.h> 
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <GL/SOIL.h>
#include <assimp/Importer.hpp>
#include <assimp/scene.h>
#include <assimp/postprocess.h>

#include <GL/Mesh.h>

GLint TextureFromFile(const char* path, string directory);

class Model
{
public:
	// Constructor, expects a filepath to a 3D model.
	Model(GLchar* path)
	{
		this->loadModel(path);
	}

	// Draws the model, and thus all its meshes
	void Draw(Shader shader)
	{
		for (GLuint i = 0; i < this->meshes.size(); i++)
			this->meshes[i].Draw(shader);
	}

	vector<Mesh> getmeshes()
	{
		return this->meshes;
	}

	vector<Texture> getmtexture()
	{
		return this->textures_loaded;
	}
	
private:
	/*  Model Data  */
	vector<Mesh> meshes;
	string directory;
	vector<Texture> textures_loaded;	//将读取过的纹理保存下来，防止重复读取同一个纹理

	void loadModel(string path)
	{
		// 通过ASSIMP读取文件
		Assimp::Importer importer;
		const aiScene* scene = importer.ReadFile(path, aiProcess_Triangulate | aiProcess_FlipUVs);
		//aiProcess_Triangulate将模型转换成由三角形组成的模型
		//aiProcess_GenNormals : 如果模型没有包含法线向量，就为每个顶点创建法线。
		//aiProcess_SplitLargeMeshes : 把大的网格分成几个小的的下级网格，当你渲染有一个最大数量顶点的限制时或者只能处理小块网格时很有用。
		//aiProcess_OptimizeMeshes : 和上个选项相反，它把几个网格结合为一个更大的网格。以减少绘制函数调用的次数的方式来优化。
		// 检查是否出错
		if (!scene || scene->mFlags == AI_SCENE_FLAGS_INCOMPLETE || !scene->mRootNode)
		{
			cout << "ERROR::ASSIMP:: " << importer.GetErrorString() << endl;
			return;
		}
		// 保存文件目录
		this->directory = path.substr(0, path.find_last_of('/'));

		// 递归加工ASSIMP读取的节点数据
		this->processNode(scene->mRootNode, scene);
	}

	// 以递归方式处理节点。处理位于节点上的每个单独的网格，并在其子节点上重复这个过程（如果有的话）。
	void processNode(aiNode* node, const aiScene* scene)
	{
		// 处理位于当前节点的每个网格
		for (GLuint i = 0; i < node->mNumMeshes; i++)
		{
			// 每个节点包含一个网格集合的索引，每个索引指向一个在场景对象中特定的网格位置
			// 场景中包含的所有数据，节点仅仅是保持数据有序整齐（如节点间关系）
			aiMesh* mesh = scene->mMeshes[node->mMeshes[i]];
			this->meshes.push_back(this->processMesh(mesh, scene));
		}
		// 递归处理子节点
		for (GLuint i = 0; i < node->mNumChildren; i++)
		{
			this->processNode(node->mChildren[i], scene);
		}

	}

	Mesh processMesh(aiMesh* mesh, const aiScene* scene)
	{
		vector<Vertex> vertices;
		vector<GLuint> indices;
		vector<Texture> textures;

		// 遍历网格中的每个顶点
		for (GLuint i = 0; i < mesh->mNumVertices; i++)
		{
			Vertex vertex;
			glm::vec3 vector; 
			// Positions
			// Assimp将它的顶点位置数组称为mVertices
			vector.x = mesh->mVertices[i].x;
			vector.y = mesh->mVertices[i].y;
			vector.z = mesh->mVertices[i].z;
			vertex.Position = vector;
			// Normals
			// Assimp将它的顶点法线数组称为mVertices
			vector.x = mesh->mNormals[i].x;
			vector.y = mesh->mNormals[i].y;
			vector.z = mesh->mNormals[i].z;
			vertex.Normal = vector;
			// Texture Coordinates
			if (mesh->mTextureCoords[0]) // 先要判但是否含有纹理坐标
			{
				glm::vec2 vec;
				// 一个顶点可以含有8组不同的纹理坐标，我们用不了那么多，所以通常只用一组就行
				vec.x = mesh->mTextureCoords[0][i].x;
				vec.y = mesh->mTextureCoords[0][i].y;
				vertex.TexCoords = vec;
			}
			else
				vertex.TexCoords = glm::vec2(0.0f, 0.0f);
			vertices.push_back(vertex);
		}
		//  现在将通过每一个网格的“面”（面是一个网格中的一个三角形）来检索相应的顶点索引。 
		for (GLuint i = 0; i < mesh->mNumFaces; i++)
		{
			aiFace face = mesh->mFaces[i];
			// 检索所有“面”即三角形的索引属性，保存下来用于绘制图形
			for (GLuint j = 0; j < face.mNumIndices; j++)
				indices.push_back(face.mIndices[j]);
		}

		if (mesh->mMaterialIndex >= 0)
		{
			//一个材质储存了一个数组，这个数组为每个纹理类型提供纹理位置。不同的纹理类型都以aiTextureType_为前缀。
			aiMaterial* material = scene->mMaterials[mesh->mMaterialIndex];
			// 我们假设在着色器中的采样器的命名按照如下方式：
			// 采用例如 'texture_diffuseN' 这种形式，其中N是标号
			// 漫反射纹理: texture_diffuseN
			// 镜面反射纹理: texture_specularN
			// 纹理法线: texture_normalN

			// 1. Diffuse maps
			vector<Texture> diffuseMaps = this->loadMaterialTextures(material, aiTextureType_DIFFUSE, "texture_diffuse");
			textures.insert(textures.end(), diffuseMaps.begin(), diffuseMaps.end());
			// 2. Specular maps
			vector<Texture> specularMaps = this->loadMaterialTextures(material, aiTextureType_SPECULAR, "texture_specular");
			textures.insert(textures.end(), specularMaps.begin(), specularMaps.end());
			// 3. Reflection maps
			vector<Texture> reflectionMaps = this->loadMaterialTextures(material, aiTextureType_AMBIENT, "texture_reflection");
			textures.insert(textures.end(), reflectionMaps.begin(), reflectionMaps.end());
		}

		// Return a mesh object created from the extracted mesh data
		return Mesh(vertices, indices, textures);
	}

	// 检查给定类型的所有材质纹理，如果没有被加载过则加载纹理。
	// 最后返回的是一个纹理结构体
	vector<Texture> loadMaterialTextures(aiMaterial* mat, aiTextureType type, string typeName)
	{
		/*
		  我们先通过GetTextureCount函数检验材质中储存的纹理，以期得到我们希望得到的纹理类型。
		  然后我们通过GetTexture函数获取每个纹理的文件位置，这个位置以aiString类型储存。
		  然后我们使用另一个帮助函数，它被命名为：TextureFromFile加载一个纹理（使用SOIL），返回纹理的ID。
		*/
		vector<Texture> textures;
		for (GLuint i = 0; i < mat->GetTextureCount(type); i++)
		{
			aiString str;
			mat->GetTexture(type, i, &str);//得到type类型中第i个纹理的路径信息并传递给str
			// 检查该纹理之前是否加载过
			GLboolean skip = false;
			for (GLuint j = 0; j < textures_loaded.size(); j++)
			{
				if (textures_loaded[j].path == str)
				{
					textures.push_back(textures_loaded[j]);
					skip = true; 
					break;
				}
			}
			if (!skip)
			{   
				Texture texture;
				texture.id = TextureFromFile(str.C_Str(), this->directory);
				texture.type = typeName;
				texture.path = str;
				textures.push_back(texture);
				this->textures_loaded.push_back(texture);  // 将加载过的纹理记录下来
			}
		}
		return textures;
	}
};



//加载纹理函数
GLint TextureFromFile(const char* path, string directory)
{
	//Generate texture ID and load texture data
	string filename = string(path);
	filename = directory + '/' + filename;
	cout << filename << endl;
	GLuint textureID;
	glGenTextures(1, &textureID);
	int width, height;
	unsigned char* image = SOIL_load_image(filename.c_str(), &width, &height, 0, SOIL_LOAD_RGB);
	// Assign texture to ID
	glBindTexture(GL_TEXTURE_2D, textureID);
	glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, image);
	glGenerateMipmap(GL_TEXTURE_2D);

	// Parameters
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
	glBindTexture(GL_TEXTURE_2D, 0);
	SOIL_free_image_data(image);
	return textureID;
}

