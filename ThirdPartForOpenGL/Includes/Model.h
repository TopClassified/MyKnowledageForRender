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
	vector<Texture> textures_loaded;	//����ȡ������������������ֹ�ظ���ȡͬһ������

	void loadModel(string path)
	{
		// ͨ��ASSIMP��ȡ�ļ�
		Assimp::Importer importer;
		const aiScene* scene = importer.ReadFile(path, aiProcess_Triangulate | aiProcess_FlipUVs);
		//aiProcess_Triangulate��ģ��ת��������������ɵ�ģ��
		//aiProcess_GenNormals : ���ģ��û�а���������������Ϊÿ�����㴴�����ߡ�
		//aiProcess_SplitLargeMeshes : �Ѵ������ֳɼ���С�ĵ��¼����񣬵�����Ⱦ��һ������������������ʱ����ֻ�ܴ���С������ʱ�����á�
		//aiProcess_OptimizeMeshes : ���ϸ�ѡ���෴�����Ѽ���������Ϊһ������������Լ��ٻ��ƺ������õĴ����ķ�ʽ���Ż���
		// ����Ƿ����
		if (!scene || scene->mFlags == AI_SCENE_FLAGS_INCOMPLETE || !scene->mRootNode)
		{
			cout << "ERROR::ASSIMP:: " << importer.GetErrorString() << endl;
			return;
		}
		// �����ļ�Ŀ¼
		this->directory = path.substr(0, path.find_last_of('/'));

		// �ݹ�ӹ�ASSIMP��ȡ�Ľڵ�����
		this->processNode(scene->mRootNode, scene);
	}

	// �Եݹ鷽ʽ����ڵ㡣����λ�ڽڵ��ϵ�ÿ�����������񣬲������ӽڵ����ظ�������̣�����еĻ�����
	void processNode(aiNode* node, const aiScene* scene)
	{
		// ����λ�ڵ�ǰ�ڵ��ÿ������
		for (GLuint i = 0; i < node->mNumMeshes; i++)
		{
			// ÿ���ڵ����һ�����񼯺ϵ�������ÿ������ָ��һ���ڳ����������ض�������λ��
			// �����а������������ݣ��ڵ�����Ǳ��������������루��ڵ���ϵ��
			aiMesh* mesh = scene->mMeshes[node->mMeshes[i]];
			this->meshes.push_back(this->processMesh(mesh, scene));
		}
		// �ݹ鴦���ӽڵ�
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

		// ���������е�ÿ������
		for (GLuint i = 0; i < mesh->mNumVertices; i++)
		{
			Vertex vertex;
			glm::vec3 vector; 
			// Positions
			// Assimp�����Ķ���λ�������ΪmVertices
			vector.x = mesh->mVertices[i].x;
			vector.y = mesh->mVertices[i].y;
			vector.z = mesh->mVertices[i].z;
			vertex.Position = vector;
			// Normals
			// Assimp�����Ķ��㷨�������ΪmVertices
			vector.x = mesh->mNormals[i].x;
			vector.y = mesh->mNormals[i].y;
			vector.z = mesh->mNormals[i].z;
			vertex.Normal = vector;
			// Texture Coordinates
			if (mesh->mTextureCoords[0]) // ��Ҫ�е��Ƿ�����������
			{
				glm::vec2 vec;
				// һ��������Ժ���8�鲻ͬ���������꣬�����ò�����ô�࣬����ͨ��ֻ��һ�����
				vec.x = mesh->mTextureCoords[0][i].x;
				vec.y = mesh->mTextureCoords[0][i].y;
				vertex.TexCoords = vec;
			}
			else
				vertex.TexCoords = glm::vec2(0.0f, 0.0f);
			vertices.push_back(vertex);
		}
		//  ���ڽ�ͨ��ÿһ������ġ��桱������һ�������е�һ�������Σ���������Ӧ�Ķ��������� 
		for (GLuint i = 0; i < mesh->mNumFaces; i++)
		{
			aiFace face = mesh->mFaces[i];
			// �������С��桱�������ε��������ԣ������������ڻ���ͼ��
			for (GLuint j = 0; j < face.mNumIndices; j++)
				indices.push_back(face.mIndices[j]);
		}

		if (mesh->mMaterialIndex >= 0)
		{
			//һ�����ʴ�����һ�����飬�������Ϊÿ�����������ṩ����λ�á���ͬ���������Ͷ���aiTextureType_Ϊǰ׺��
			aiMaterial* material = scene->mMaterials[mesh->mMaterialIndex];
			// ���Ǽ�������ɫ���еĲ������������������·�ʽ��
			// �������� 'texture_diffuseN' ������ʽ������N�Ǳ��
			// ����������: texture_diffuseN
			// ���淴������: texture_specularN
			// ������: texture_normalN

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

	// ���������͵����в����������û�б����ع����������
	// ��󷵻ص���һ������ṹ��
	vector<Texture> loadMaterialTextures(aiMaterial* mat, aiTextureType type, string typeName)
	{
		/*
		  ������ͨ��GetTextureCount������������д�����������ڵõ�����ϣ���õ����������͡�
		  Ȼ������ͨ��GetTexture������ȡÿ��������ļ�λ�ã����λ����aiString���ʹ��档
		  Ȼ������ʹ����һ��������������������Ϊ��TextureFromFile����һ������ʹ��SOIL�������������ID��
		*/
		vector<Texture> textures;
		for (GLuint i = 0; i < mat->GetTextureCount(type); i++)
		{
			aiString str;
			mat->GetTexture(type, i, &str);//�õ�type�����е�i�������·����Ϣ�����ݸ�str
			// ��������֮ǰ�Ƿ���ع�
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
				this->textures_loaded.push_back(texture);  // �����ع��������¼����
			}
		}
		return textures;
	}
};



//����������
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

