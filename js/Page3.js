export function initUserInfo(elementId) {
    console.log('initUserInfo function called with elementId:', elementId);

    function updateUserInfo() {
        const userInfo = document.getElementById(elementId);
        console.log('userInfo element:', userInfo);

        if (!userInfo) {
            console.warn(`Element with id "${elementId}" not found`);
            return;
        }

        const user = JSON.parse(localStorage.getItem("user"));
        console.log("User data from localStorage:", user);

        if (user) {
            userInfo.textContent = `当前用户: ${user.username}`;
            console.log('User info updated with username:', user.username);
        } else {
            userInfo.textContent = "未登录";
            console.log('User info updated to "未登录"');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateUserInfo);
    } else {
        updateUserInfo();
    }
}

// 修复字段不一致问题：使用 _id 而不是 id
export function getUserId() {
    const user = JSON.parse(localStorage.getItem("user"));
    return user ? user._id : null; // 改为 _id
}

// 新增获取用户名的函数
export function getUsername() {
    const user = JSON.parse(localStorage.getItem("user"));
    return user ? user.username : null;
}

// 新增获取完整用户信息的函数
export function getUser() {
    return JSON.parse(localStorage.getItem("user"));
}

console.log('Page3.js is loaded');