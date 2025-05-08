/**
 * ฟังก์ชันสำหรับสร้างการแจ้งเตือนที่มี reference_id ที่ถูกต้อง
 * @param {Object} supabase - Supabase client
 * @param {Object} options - ตัวเลือกสำหรับการสร้างการแจ้งเตือน
 * @param {string} options.userId - ID ของผู้ใช้ที่จะได้รับการแจ้งเตือน
 * @param {string} options.type - ประเภทของการแจ้งเตือน (message, match, interest)
 * @param {string} options.senderId - ID ของผู้ส่งการแจ้งเตือน (ถ้ามี)
 * @param {string} options.content - เนื้อหาของการแจ้งเตือน (ถ้ามี)
 * @param {string} options.referenceId - ID อ้างอิง (เช่น conversation_id, pet_id)
 * @param {Object} options.data - ข้อมูลเพิ่มเติมของการแจ้งเตือน (ถ้ามี)
 * @returns {Promise<Object>} - ข้อมูลการแจ้งเตือนที่สร้างขึ้น
 */
export async function createNotification(supabase, options) {
  try {
    const { userId, type, senderId, content, referenceId, data } = options

    // ตรวจสอบว่ามีข้อมูลที่จำเป็นครบถ้วนหรือไม่
    if (!userId || !type) {
      throw new Error("userId และ type เป็นข้อมูลที่จำเป็น")
    }

    // ตรวจสอบ reference_id ตามประเภทของการแจ้งเตือน
    let validatedReferenceId = referenceId

    if (type === "message" && referenceId) {
      // ตรวจสอบว่าการสนทนามีอยู่จริงหรือไม่
      const { data: conversation, error } = await supabase
        .from("direct_conversations")
        .select("id")
        .eq("id", referenceId)
        .single()

      if (error || !conversation) {
        console.error("ไม่พบการสนทนาที่อ้างถึง:", referenceId, error)
        // ถ้าไม่พบการสนทนา ให้ตั้งค่า reference_id เป็น null
        validatedReferenceId = null
      }
    } else if (type === "interest" && referenceId) {
      // ตรวจสอบว่าสัตว์เลี้ยงมีอยู่จริงหรือไม่
      const { data: pet, error } = await supabase.from("pets").select("id").eq("id", referenceId).single()

      if (error || !pet) {
        console.error("ไม่พบสัตว์เลี้ยงที่อ้างถึง:", referenceId, error)
        // ถ้าไม่พบสัตว์เลี้ยง ให้ตั้งค่า reference_id เป็น null
        validatedReferenceId = null
      }
    }

    // ลบการแจ้งเตือนเก่าที่มีลักษณะเดียวกันก่อน
    try {
      // สร้างเงื่อนไขสำหรับการลบ
      let deleteQuery = supabase.from("notifications").delete().eq("user_id", userId).eq("type", type)

      // เพิ่มเงื่อนไข reference_id ถ้ามี
      if (validatedReferenceId !== undefined && validatedReferenceId !== null) {
        deleteQuery = deleteQuery.eq("reference_id", validatedReferenceId)
      } else {
        deleteQuery = deleteQuery.is("reference_id", null)
      }

      // เพิ่มเงื่อนไข sender_id ถ้ามี
      if (senderId !== undefined && senderId !== null) {
        deleteQuery = deleteQuery.eq("sender_id", senderId)
      } else {
        deleteQuery = deleteQuery.is("sender_id", null)
      }

      // ดำเนินการลบ
      const { error: deleteError } = await deleteQuery

      if (deleteError) {
        console.error("เกิดข้อผิดพลาดในการลบการแจ้งเตือนเก่า:", deleteError)
      } else {
        console.log("ลบการแจ้งเตือนเก่าสำเร็จ")
      }
    } catch (deleteError) {
      console.error("เกิดข้อผิดพลาดในการลบการแจ้งเตือนเก่า:", deleteError)
      // ดำเนินการต่อแม้จะมีข้อผิดพลาดในการลบ
    }

    // สร้างการแจ้งเตือนใหม่
    const notificationData = {
      user_id: userId,
      type,
      sender_id: senderId || null,
      content: content || null,
      reference_id: validatedReferenceId || null,
      data: data || null,
      is_read: false,
      reference_type: null, // ตั้งค่า reference_type เป็น null เสมอ
    }

    try {
      // บันทึกการแจ้งเตือนลงในฐานข้อมูล
      const { data: notification, error } = await supabase
        .from("notifications")
        .insert(notificationData)
        .select()
        .single()

      if (error) {
        console.error("เกิดข้อผิดพลาดในการสร้างการแจ้งเตือน:", error)
        return null
      }

      console.log("สร้างการแจ้งเตือนสำเร็จ:", notification)
      return notification
    } catch (insertError) {
      console.error("เกิดข้อผิดพลาดในการสร้างการแจ้งเตือน:", insertError)
      return null
    }
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการสร้างการแจ้งเตือน:", error)
    return null // เปลี่ยนจาก throw error เป็น return null เพื่อไม่ให้แอปพลิเคชันล่ม
  }
}

/**
 * ฟังก์ชันสำหรับสร้างการแจ้งเตือนข้อความใหม่
 * @param {Object} supabase - Supabase client
 * @param {string} userId - ID ของผู้ใช้ที่จะได้รับการแจ้งเตือน
 * @param {string} senderId - ID ของผู้ส่งข้อความ
 * @param {string} conversationId - ID ของการสนทนา
 * @param {string} messageContent - เนื้อหาของข้อความ (ถ้ามี)
 * @returns {Promise<Object>} - ข้อมูลการแจ้งเตือนที่สร้างขึ้น
 */
export async function createMessageNotification(supabase, userId, senderId, conversationId, messageContent) {
  console.log(`Creating message notification: userId=${userId}, senderId=${senderId}, conversationId=${conversationId}`)

  // ตรวจสอบว่าการสนทนามีอยู่จริงหรือไม่
  const { data: conversations, error } = await supabase
    .from("direct_conversations")
    .select("id")
    .eq("id", conversationId)

  if (error) {
    console.error("เกิดข้อผิดพลาดในการตรวจสอบการสนทนา:", conversationId, error)
    return null
  }

  if (!conversations || conversations.length === 0) {
    console.error("ไม่พบการสนทนาที่อ้างถึง:", conversationId)
    return null
  }

  console.log("สร้างการแจ้งเตือนสำหรับ conversation ID:", conversationId)

  // ลบการแจ้งเตือนเก่าทั้งหมดสำหรับการสนทนานี้ก่อน
  try {
    const { error: deleteError } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", userId)
      .eq("type", "message")
      .eq("reference_id", conversationId)
      .eq("sender_id", senderId)

    if (deleteError) {
      console.error("เกิดข้อผิดพลาดในการลบการแจ้งเตือนเก่า:", deleteError)
    } else {
      console.log("ลบการแจ้งเตือนเก่าสำเร็จ")
    }
  } catch (deleteError) {
    console.error("เกิดข้อผิดพลาดในการลบการแจ้งเตือนเก่า:", deleteError)
  }

  // สร้างเนื้อหาของการแจ้งเตือน - ใช้ข้อความคงที่ไม่แสดงเนื้อหาข้อความ
  const content = "คุณมีข้อความใหม่"

  // สร้างการแจ้งเตือนใหม่
  return createNotification(supabase, {
    userId,
    type: "message",
    senderId,
    content,
    referenceId: conversationId,
    data: {
      conversation_id: conversationId,
      // ไม่เก็บ message_preview เพื่อไม่ให้มีการแสดงเนื้อหาข้อความ
    },
  })
}

/**
 * ฟังก์ชันสำหรับสร้างการแจ้งเตือนการจับคู่
 * @param {Object} supabase - Supabase client
 * @param {string} userId - ID ของผู้ใช้ที่จะได้รับการแจ้งเตือน
 * @param {string} senderId - ID ของผู้ใช้อีกฝ่าย
 * @param {string} petId - ID ของสัตว์เลี้ยงที่จับคู่
 * @returns {Promise<Object>} - ข้อมูลการแจ้งเตือนที่สร้างขึ้น
 */
export async function createMatchNotification(supabase, userId, senderId, petId) {
  // ตรวจสอบว่ามีการแจ้งเตือนการจับคู่นี้อยู่แล้วหรือไม่
  const { data: existingNotifications, error: checkError } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "match")
    .eq("reference_id", petId)
    .eq("sender_id", senderId)
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(1)

  if (checkError) {
    console.error("เกิดข้อผิดพลาดในการตรวจสอบการแจ้งเตือนที่มีอยู่:", checkError)
  }

  // ถ้ามีการแจ้งเตือนอยู่แล้ว ให้ลบและสร้างใหม่
  if (existingNotifications && existingNotifications.length > 0) {
    console.log("พบการแจ้งเตือนการจับคู่ที่มีอยู่แล้ว ID:", existingNotifications[0].id)

    // ลบการแจ้งเตือนเดิม
    const { error: deleteError } = await supabase.from("notifications").delete().eq("id", existingNotifications[0].id)

    if (deleteError) {
      console.error("เกิดข้อผิดพลาดในการลบการแจ้งเตือนเดิม:", deleteError)
    } else {
      console.log("ลบการแจ้งเตือนเดิมสำเร็จ")
    }
  }

  return createNotification(supabase, {
    userId,
    type: "match",
    senderId,
    content: "🎉 คุณได้จับคู่กับสัตว์เลี้ยงใหม่!",
    referenceId: petId,
    data: {
      pet_id: petId,
    },
  })
}

/**
 * ฟังก์ชันสำหรับสร้างการแจ้งเตือนความสนใจ
 * @param {Object} supabase - Supabase client
 * @param {string} userId - ID ของผู้ใช้ที่จะได้รับการแจ้งเตือน
 * @param {string} senderId - ID ของผู้ใช้ที่แสดงความสนใจ
 * @param {string} petId - ID ของสัตว์เลี้ยงที่ได้รับความสนใจ
 * @returns {Promise<Object>} - ข้อมูลการแจ้งเตือนที่สร้างขึ้น
 */
export async function createInterestNotification(supabase, userId, senderId, petId) {
  return createNotification(supabase, {
    userId,
    type: "interest",
    senderId,
    content: "มีคนสนใจสัตว์เลี้ยงของคุณ",
    referenceId: petId,
    data: {
      pet_id: petId,
    },
  })
}

/**
 * ฟังก์ชันสำหรับค้นหาการแจ้งเตือนที่มีข้อมูลไม่ถูกต้อง
 * @param {Object} supabase - Supabase client
 * @param {Object} options - ตัวเลือกในการค้นหา
 * @returns {Promise<Array>} - รายการการแจ้งเตือนที่มีข้อมูลไม่ถูกต้อง
 */
export async function findInvalidNotifications(supabase, options = {}) {
  try {
    // ดึงข้อมูลการแจ้งเตือน
    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) {
      throw error
    }

    return notifications.filter((notification) => {
      // ตรวจสอบความถูกต้องของการแจ้งเตือน
      return false // ตัวอย่างเท่านั้น ควรใช้ตรรกะจริงในการตรวจสอบ
    })
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการค้นหาการแจ้งเตือนที่ไม่ถูกต้อง:", error)
    return []
  }
}

/**
 * ฟังก์ชันสำหรับลบการแจ้งเตือนที่มีข้อมูลไม่ถูกต้อง
 * @param {Object} supabase - Supabase client
 * @param {Array} notificationIds - รายการ ID ของการแจ้งเตือนที่ต้องการลบ
 * @returns {Promise<Object>} - ผลการลบการแจ้งเตือน
 */
export async function deleteInvalidNotifications(supabase, notificationIds) {
  try {
    if (!notificationIds || notificationIds.length === 0) {
      return { count: 0, success: true }
    }

    // ลบการแจ้งเตือนตาม ID
    const { error } = await supabase.from("notifications").delete().in("id", notificationIds)

    if (error) {
      throw error
    }

    return { count: notificationIds.length, success: true }
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการลบการแจ้งเตือน:", error)
    return { count: 0, success: false, error: error.message }
  }
}

/**
 * ฟังก์ชันสำหรับลบการแจ้งเตือนซ้ำซ้อนทั้งหมด
 * @param {Object} supabase - Supabase client
 * @param {string} userId - ID ของผู้ใช้
 * @returns {Promise<Object>} - ผลการลบการแจ้งเตือนซ้ำซ้อน
 */
export async function cleanupDuplicateNotifications(supabase, userId) {
  try {
    if (!userId) {
      return { success: false, error: "ต้องระบุ userId" }
    }

    // ดึงการแจ้งเตือนทั้งหมดของผู้ใช้
    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      throw error
    }

    if (!notifications || notifications.length === 0) {
      return { success: true, count: 0 }
    }

    // เก็บ ID ของการแจ้งเตือนที่ต้องการเก็บไว้ (ล่าสุดของแต่ละประเภท)
    const uniqueNotifications = new Map() // คีย์: type_sender_id_conversation_id, ค่า: notification
    const duplicateIds = []

    // จัดกลุ่มการแจ้งเตือนและเก็บเฉพาะรายการล่าสุดของแต่ละกลุ่ม
    notifications.forEach((notification) => {
      // สำหรับการแจ้งเตือนประเภทข้อความ ให้ใช้ conversation_id จาก data เป็นหลัก
      let keyId = notification.reference_id || ""

      if (notification.type === "message" && notification.data && notification.data.conversation_id) {
        keyId = notification.data.conversation_id
      }

      const key = `${notification.type}_${notification.sender_id || ""}_${keyId}`

      if (!uniqueNotifications.has(key)) {
        uniqueNotifications.set(key, notification)
      } else {
        // ถ้ามีการแจ้งเตือนนี้ใน Map แล้ว ให้เพิ่มลงในรายการที่จะลบ
        duplicateIds.push(notification.id)
      }
    })

    // ลบการแจ้งเตือนที่ซ้ำกัน
    if (duplicateIds.length > 0) {
      const { error: deleteError } = await supabase.from("notifications").delete().in("id", duplicateIds)

      if (deleteError) {
        throw deleteError
      }

      console.log(`ลบการแจ้งเตือนซ้ำซ้อนสำเร็จ ${duplicateIds.length} รายการ`)
      return { success: true, count: duplicateIds.length }
    }

    return { success: true, count: 0 }
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการลบการแจ้งเตือนซ้ำซ้อน:", error)
    return { success: false, error: error.message }
  }
}
