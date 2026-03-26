/*
 * Project: IoT Snake Game (Bug Fixed & HUD Added)
 * Hardware: M5StickC PLUS 1.1 + ENV Unit (Port A)
 * Feature: Top UI Bar (Time & Temp), JSON Telemetry
 */

#include <M5StickCPlus.h>
#include <M5UnitENV.h> 

// --- 网格系统配置 ---
#define BLOCK_SIZE 5
#define GRID_W 27
#define GRID_H 48
#define GRID_Y_START 3 // 【核心改动】预留顶部 3 行 (15像素) 给 UI 状态栏，蛇不能进入

// --- 传感器对象与状态 ---
SHT3X sht30; 
bool hasEnv = false; 

// --- 游戏状态变量 ---
#define MAX_SNAKE_LEN 300 
int snakeX[MAX_SNAKE_LEN];
int snakeY[MAX_SNAKE_LEN];
int snakeLen = 3; 
int fruitX, fruitY;

enum Direction { UP_DIR = 0, RIGHT_DIR = 1, DOWN_DIR = 2, LEFT_DIR = 3 };
Direction currentDir = UP_DIR;

unsigned long lastMoveTime = 0;
unsigned long lastHudTime = 0;   // UI 刷新定时器
unsigned long gameStartTime = 0; 
int currentSpeed = 250; 
const int MIN_SPEED = 50; 

bool gameOver = false;
bool gameWon = false;
bool hasTurnedThisStep = false;

// --- 函数声明 ---
void showStartScreen();
void initGame();
void moveSnake();
void spawnFruit();
void drawBlock(int x, int y, uint16_t color);
void handleGameOver();
void handleVictoryScreen();
void logTelemetry(const char* eventType);
void updateHUD(); // 新增：UI 更新函数

void setup() {
    M5.begin();
    Serial.begin(115200); 
    
    M5.Lcd.setRotation(0); 
    M5.Lcd.fillScreen(BLACK);

    Wire1.begin(32, 33);
    if (sht30.begin(&Wire1, SHT3X_I2C_ADDR, 32, 33, 400000U)) {
        hasEnv = true;
        Serial.println("{\"sys\":\"ENV Sensor Initialized on Wire1\"}");
    } else {
        hasEnv = false;
        Serial.println("{\"sys\":\"ENV Sensor NOT found.\"}");
    }

    randomSeed(analogRead(36)); 
    showStartScreen();
}

void loop() {
    M5.update();

    if (gameOver) {
        handleGameOver();
        return; 
    }
    if (gameWon) {
        handleVictoryScreen();
        return;
    }

    // 相对转向控制
    if (M5.BtnA.wasPressed() && !hasTurnedThisStep) {
        currentDir = static_cast<Direction>((currentDir + 3) % 4);
        hasTurnedThisStep = true; 
    }
    else if (M5.BtnB.wasPressed() && !hasTurnedThisStep) {
        currentDir = static_cast<Direction>((currentDir + 1) % 4);
        hasTurnedThisStep = true; 
    }

    // 蛇的移动逻辑 (非阻塞)
    if (millis() - lastMoveTime > currentSpeed) {
        moveSnake();
        lastMoveTime = millis();
        hasTurnedThisStep = false; 
    }

    // UI 状态栏刷新逻辑 (每 1 秒刷新一次，防止频闪)
    if (millis() - lastHudTime > 1000) {
        updateHUD();
        lastHudTime = millis();
    }
}

// ================= 新增：UI 状态栏 =================
void updateHUD() {
    // 擦除顶部 14 像素的区域，准备重绘文字
    M5.Lcd.fillRect(0, 0, 135, 14, BLACK); 
    
    M5.Lcd.setTextSize(1);
    M5.Lcd.setTextColor(WHITE);

    // 1. 左上角显示存活时间
    unsigned long playTime = (millis() - gameStartTime) / 1000;
    M5.Lcd.setCursor(2, 3);
    M5.Lcd.printf("T:%lus", playTime);

    // 2. 右上角显示实时温度
    M5.Lcd.setCursor(65, 3);
    if (hasEnv && sht30.update()) {
        M5.Lcd.printf("%.1f C", sht30.cTemp);
    } else {
        M5.Lcd.print("No ENV");
    }

    // 绘制一条灰色的分割线，把 UI 和 游戏区 分开
    M5.Lcd.drawLine(0, 14, 135, 14, DARKGREY); 
}

// ================= 核心业务与数据上报 =================

void moveSnake() {
    int nextX = snakeX[0];
    int nextY = snakeY[0];

    switch (currentDir) {
        case UP_DIR:    nextY--; break;
        case DOWN_DIR:  nextY++; break;
        case RIGHT_DIR: nextX++; break;
        case LEFT_DIR:  nextX--; break;
    }

    // 碰撞检测：注意 Y 轴的顶部边界变成了 GRID_Y_START (保护 UI 区域)
    if (nextX < 0 || nextX >= GRID_W || nextY < GRID_Y_START || nextY >= GRID_H) {
        gameOver = true;
        logTelemetry("GAME_OVER");
        return;
    }
    for (int i = 0; i < snakeLen; i++) {
        if (snakeX[i] == nextX && snakeY[i] == nextY) {
            gameOver = true;
            logTelemetry("GAME_OVER");
            return;
        }
    }

    bool ateFruit = (nextX == fruitX && nextY == fruitY);
    int tailX = snakeX[snakeLen - 1];
    int tailY = snakeY[snakeLen - 1];

    for (int i = snakeLen - 1; i > 0; i--) {
        snakeX[i] = snakeX[i - 1];
        snakeY[i] = snakeY[i - 1];
    }
    snakeX[0] = nextX;
    snakeY[0] = nextY;

    if (ateFruit) {
        snakeLen++;
        
        // 【BUG 修复】把吃果子前记录的老尾巴坐标，赋值给新长出来的这一节！
        snakeX[snakeLen - 1] = tailX;
        snakeY[snakeLen - 1] = tailY;

        logTelemetry("FRUIT_EATEN"); 

        if (snakeLen - 3 >= 10) {
            gameWon = true; 
            logTelemetry("VICTORY");
            return;
        }
        spawnFruit(); 
        if (currentSpeed > MIN_SPEED) currentSpeed -= 10; 
    } else {
        drawBlock(tailX, tailY, BLACK);
    }
    drawBlock(snakeX[0], snakeY[0], GREEN);
}

void logTelemetry(const char* eventType) {
    float temp = 0.0, hum = 0.0;
    int score = (snakeLen - 3) * 10;
    unsigned long duration = (millis() - gameStartTime) / 1000;

    if (hasEnv) { temp = sht30.cTemp; hum = sht30.humidity; }

    if (strcmp(eventType, "FRUIT_EATEN") == 0) {
        Serial.printf("{\"event\":\"%s\", \"score\":%d, \"temp_c\":%.1f, \"hum_pct\":%.1f}\n", 
                      eventType, score, temp, hum);
    } 
    else if (strcmp(eventType, "GAME_OVER") == 0 || strcmp(eventType, "VICTORY") == 0) {
        Serial.printf("{\"event\":\"%s\", \"final_score\":%d, \"time_sec\":%lu, \"final_temp\":%.1f}\n", 
                      eventType, score, duration, temp);
    }
}

// ================= UI 与 初始化 =================

void showStartScreen() {
    M5.Lcd.fillScreen(BLACK);
    M5.Lcd.setTextSize(2); M5.Lcd.setTextColor(GREEN);
    M5.Lcd.setCursor(7, 80); M5.Lcd.print("Welcome to");
    M5.Lcd.setTextSize(3); M5.Lcd.setTextColor(WHITE);
    M5.Lcd.setCursor(22, 110); M5.Lcd.print("SNAKE");
    M5.Lcd.setTextSize(1); M5.Lcd.setTextColor(LIGHTGREY);
    M5.Lcd.setCursor(19, 180); M5.Lcd.print("Press A to Start");

    while (true) {
        M5.update();
        if (M5.BtnA.wasPressed()) {
            initGame();
            break;
        }
        delay(10);
    }
}

void initGame() {
    M5.Lcd.fillScreen(BLACK);
    snakeLen = 3;
    currentSpeed = 250;
    currentDir = UP_DIR;
    gameOver = false;
    gameWon = false;
    gameStartTime = millis(); 

    int startX = GRID_W / 2;
    int startY = GRID_H - 10;
    for (int i = 0; i < snakeLen; i++) {
        snakeX[i] = startX;
        snakeY[i] = startY + i; 
        drawBlock(snakeX[i], snakeY[i], GREEN);
    }
    
    updateHUD(); // 初始化时立刻画一次 UI，不用等 1 秒
    lastHudTime = millis();
    spawnFruit();
    lastMoveTime = millis();
    Serial.println("{\"event\":\"GAME_STARTED\"}");
}

// 胜利和失败界面保持原样
void handleVictoryScreen() {
    M5.Lcd.fillScreen(BLACK);
    M5.Lcd.setTextSize(2); M5.Lcd.setTextColor(YELLOW);
    M5.Lcd.setCursor(37, 80); M5.Lcd.print("LEVEL");
    M5.Lcd.setCursor(19, 110); M5.Lcd.print("CLEARED!");
    M5.Lcd.setTextSize(1); M5.Lcd.setCursor(40, 140); M5.Lcd.print("Score: 100");
    M5.Lcd.setCursor(19, 180); M5.Lcd.print("Press A to Restart");
    while (true) { M5.update(); if (M5.BtnA.wasPressed()) { initGame(); break; } delay(10); }
}

void handleGameOver() {
    M5.Lcd.fillScreen(BLACK);
    M5.Lcd.setTextSize(2); M5.Lcd.setTextColor(RED);
    M5.Lcd.setCursor(13, 90); M5.Lcd.print("GAME OVER");
    M5.Lcd.setTextSize(1); M5.Lcd.setCursor(40, 130); M5.Lcd.printf("Score: %d", (snakeLen-3)*10);
    M5.Lcd.setCursor(19, 180); M5.Lcd.print("Press A to Restart");
    while (true) { M5.update(); if (M5.BtnA.wasPressed()) { initGame(); break; } delay(10); }
}

void spawnFruit() {
    bool valid = false;
    while (!valid) {
        fruitX = random(0, GRID_W);
        // 【边界修改】果子不能生成在 UI 状态栏里
        fruitY = random(GRID_Y_START, GRID_H); 
        valid = true;
        for (int i = 0; i < snakeLen; i++) {
            if (snakeX[i] == fruitX && snakeY[i] == fruitY) {
                valid = false; break;
            }
        }
    }
    drawBlock(fruitX, fruitY, RED);
}

void drawBlock(int x, int y, uint16_t color) {
    M5.Lcd.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE, color);
}
