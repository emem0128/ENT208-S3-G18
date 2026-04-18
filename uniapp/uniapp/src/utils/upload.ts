// 图片上传工具函数
import Taro from '@tarojs/taro'
import {supabase} from '@/client/supabase'
import type {UploadFileInput} from '@/db/types'

const BUCKET_NAME = 'receipt-images'
const MAX_FILE_SIZE = 1024 * 1024 // 1MB

/**
 * 压缩图片
 */
async function compressImage(filePath: string, quality = 80): Promise<string> {
  try {
    const result = await Taro.compressImage({
      src: filePath,
      quality
    })
    return result.tempFilePath
  } catch (error) {
    console.error('压缩图片失败:', error)
    return filePath
  }
}

/**
 * 生成唯一文件名
 */
function generateFileName(originalName?: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const ext = originalName?.split('.').pop() || 'jpg'
  return `receipt_${timestamp}_${random}.${ext}`
}

/**
 * 上传单个文件到 Supabase Storage
 */
export async function uploadFile(file: UploadFileInput): Promise<{
  success: boolean
  url?: string
  error?: string
}> {
  try {
    let filePath = file.path
    let fileSize = file.size

    // 如果文件超过1MB，进行压缩
    if (fileSize > MAX_FILE_SIZE) {
      let quality = 80
      while (quality > 20) {
        const compressedPath = await compressImage(filePath, quality)
        try {
          const fileInfo = await Taro.getFileInfo({filePath: compressedPath})
          if ('size' in fileInfo) {
            fileSize = fileInfo.size
          }
        } catch (error) {
          console.error('获取文件信息失败:', error)
          break
        }

        if (fileSize <= MAX_FILE_SIZE) {
          filePath = compressedPath
          break
        }

        quality -= 10
      }

      if (fileSize > MAX_FILE_SIZE) {
        return {
          success: false,
          error: '图片压缩后仍超过1MB，请选择更小的图片'
        }
      }
    }

    const fileName = generateFileName(file.name)

    // H5 环境使用 originalFileObj，小程序环境使用 tempFilePath
    const fileContent = file.originalFileObj || ({tempFilePath: filePath} as any)

    const {data, error} = await supabase.storage.from(BUCKET_NAME).upload(fileName, fileContent)

    if (error) {
      console.error('上传文件失败:', error)
      return {
        success: false,
        error: error.message || '上传失败'
      }
    }

    // 获取公开URL
    const {data: urlData} = supabase.storage.from(BUCKET_NAME).getPublicUrl(data.path)

    return {
      success: true,
      url: urlData.publicUrl
    }
  } catch (error) {
    console.error('上传文件异常:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '上传失败'
    }
  }
}

/**
 * 批量上传文件
 */
export async function uploadFiles(files: UploadFileInput[]): Promise<{
  success: boolean
  urls: string[]
  errors: string[]
}> {
  const results = await Promise.all(files.map((file) => uploadFile(file)))

  const urls: string[] = []
  const errors: string[] = []

  results.forEach((result, index) => {
    if (result.success && result.url) {
      urls.push(result.url)
    } else {
      errors.push(`第${index + 1}张图片: ${result.error || '上传失败'}`)
    }
  })

  return {
    success: errors.length === 0,
    urls,
    errors
  }
}

/**
 * 选择图片
 */
export async function chooseImages(maxCount = 9): Promise<UploadFileInput[]> {
  try {
    const res = await Taro.chooseImage({
      count: maxCount,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera']
    })

    const uploadFiles: UploadFileInput[] = res.tempFiles.map((file, index) => ({
      path: file.path,
      size: file.size || 0,
      name: `image_${Date.now()}_${index}.jpg`,
      originalFileObj: (file as any).originalFileObj
    }))

    return uploadFiles
  } catch (error) {
    console.error('选择图片失败:', error)
    return []
  }
}

/**
 * 获取图片公开URL（兼容已有URL和路径）
 */
export function getImageUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return ''

  // 如果已经是完整URL，直接返回
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl
  }

  // 否则从 storage 获取公开URL
  const {data} = supabase.storage.from(BUCKET_NAME).getPublicUrl(pathOrUrl)
  return data.publicUrl
}
