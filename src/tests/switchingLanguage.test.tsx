import { describe, expect, it, vi } from 'vitest'
import { openAquarium } from './aquariumPage'

/**
 * 界面语言这一条盯的是三件事：切了以后屏幕上的字真的换了、下次进来还记得、以及切
 * 语言不该把缸也一起重置掉。
 *
 * 别处的用例都跑在中文界面上（openAquarium 默认写死中文），所以这个文件里的每一条
 * 都自己开缸，开局条件本身就是被测的东西。
 */
describe('中英文切换', () => {
  it('切到英文，面板上的字跟着换', async () => {
    // Given 观众打开的是中文界面
    const aquarium = await openAquarium()
    expect(aquarium.isLanguageChosen('zh')).toBe(true)

    // When 观众点了左下角的 English
    await aquarium.chooseLanguage('en')

    // Then 标题、介绍、两块面板和角落的提示都成了英文
    await expect.element(aquarium.heading()).toHaveTextContent('Electronic Aquarium')
    await expect
      .element(aquarium.text('An underwater world that needs no looking after'))
      .toBeVisible()
    expect(aquarium.market().offered()).toEqual([
      'Barramundi',
      'Blue tang',
      'Clownfish',
      'Goldfish',
      'Tuna',
    ])
    expect(aquarium.market().tally()).toBe('6 in the tank · 8 max')
    expect(aquarium.chosenTankSize()).toBe('Standard · 60 × 30 × 36 cm')
    await expect.element(aquarium.capacity()).toHaveTextContent('About 64.8 L')
    await expect.element(aquarium.text('Drag to rotate')).toBeVisible()

    /**
     * 加减按钮只有图标，名字全靠 aria-label——屏幕阅读器念的就是这一句。鱼名在句中
     * 转成小写（blue tang，不是 Blue tang），而列表里那一行仍是句首大写。
     */
    expect(aquarium.market().buttonNames().slice(0, 4)).toEqual([
      'Remove one barramundi',
      'Add one barramundi',
      'Remove one blue tang',
      'Add one blue tang',
    ])

    // 而且那颗按钮标出了当前用的就是英文
    expect(aquarium.isLanguageChosen('en')).toBe(true)
    expect(aquarium.isLanguageChosen('zh')).toBe(false)
  })

  it('切回中文，字也跟着回来', async () => {
    // Given 观众先切到了英文
    const aquarium = await openAquarium()
    await aquarium.chooseLanguage('en')

    // When 观众又点了中文
    await aquarium.chooseLanguage('zh')

    // Then 面板上是中文，鱼名也回到了译名
    await expect.element(aquarium.heading()).toHaveTextContent('电子鱼缸')
    expect(aquarium.market().offered()).toEqual([
      '尖吻鲈',
      '蓝刀鲷',
      '小丑鱼',
      '金鱼',
      '金枪鱼',
    ])
    expect(aquarium.market().tally()).toBe('缸里 6 条 · 上限 8 条')
    expect(aquarium.isLanguageChosen('zh')).toBe(true)
  })

  /**
   * 加载幕布的样子写死在 index.html 里（它要早于 JavaScript 就画出来），字则由
   * LoadingCurtain 按语言填。所以这条盯的是：英文观众看到的幕布也是英文的。
   */
  it('加载幕布上的字也跟着语言', async () => {
    // Given 一台英文浏览器，观众头一次进来，模型还在下
    const aquarium = await openAquarium({
      browserLanguage: 'en-US',
      language: 'browser',
      stallModels: true,
    })

    // Then 幕布上那两行是英文，而不是缸原本的中文
    expect(aquarium.language()).toBe('en')
    await vi.waitFor(() =>
      expect(aquarium.loadingCurtainWords()).toEqual(['Filling the tank', 'Putting the fish in']),
    )
  })

  /**
   * `<html lang>` 决定屏幕阅读器怎么念，也影响字体和断词，而 i18next 不碰这个属性，
   * 是我们自己写的。
   *
   * 吃住的是中文那一侧（`zh-CN`）：vitest 的宿主页面本身就是 `<html lang="en">`，
   * 所以只断言切到英文后它是 `en`，代码一行不写也照样绿。
   */
  it('标签页的标题和文档语言跟着切', async () => {
    // Given 中文界面下，标签页和文档语言都是中文
    const aquarium = await openAquarium()
    expect(aquarium.documentTitle()).toBe('电子鱼缸')
    expect(aquarium.language()).toBe('zh')
    expect(document.documentElement.lang).toBe('zh-CN')

    // When 切到英文
    await aquarium.chooseLanguage('en')

    // Then 标签页和 `<html lang>` 都跟着变了
    expect(aquarium.documentTitle()).toBe('Electronic Aquarium')
    expect(document.documentElement.lang).toBe('en')
  })

  /**
   * 这两条特意把浏览器偏好设成和所选语言相反的那种。
   *
   * 不这么设的话它们是白测的：无头 Chromium 报的是 en-US，切到英文后就算一个字都没
   * 存下来，下次进来也照样是英文——断言绿着，存储那条路其实断了。
   */
  it('下次进来还记得观众选的英文，即便浏览器偏好是中文', async () => {
    // Given 浏览器偏好是中文，观众手动切到了英文
    const aquarium = await openAquarium({ browserLanguage: 'zh-CN' })
    await aquarium.chooseLanguage('en')

    // When 观众关掉页面又回来
    await aquarium.revisit()

    // Then 界面还是英文，而不是退回浏览器偏好的中文
    expect(aquarium.language()).toBe('en')
    await expect.element(aquarium.heading()).toHaveTextContent('Electronic Aquarium')
  })

  it('下次进来还记得观众选的中文，即便浏览器偏好是英文', async () => {
    // Given 浏览器偏好是英文，观众手动切到了中文
    const aquarium = await openAquarium({ browserLanguage: 'en-US', language: 'browser' })
    expect(aquarium.language()).toBe('en')
    await aquarium.chooseLanguage('zh')

    // When 观众关掉页面又回来
    await aquarium.revisit()

    // Then 界面还是中文
    expect(aquarium.language()).toBe('zh')
    await expect.element(aquarium.heading()).toHaveTextContent('电子鱼缸')
  })

  it('没选过的话，头一次进来跟着浏览器偏好', async () => {
    // Given 一台中文浏览器，观众没选过语言
    const chinese = await openAquarium({ browserLanguage: 'zh-CN', language: 'browser' })

    // Then 开局就是中文
    expect(chinese.language()).toBe('zh')
    await expect.element(chinese.heading()).toHaveTextContent('电子鱼缸')
  })

  it('浏览器偏好既不是中文也不是英文时，给英文', async () => {
    // Given 一台法语浏览器
    const french = await openAquarium({ browserLanguage: 'fr-FR', language: 'browser' })

    // Then 落到英文，而不是中文
    expect(french.language()).toBe('en')
    await expect.element(french.heading()).toHaveTextContent('Electronic Aquarium')
  })

  /**
   * 换语言只该换掉界面上的字。
   *
   * 一旦语言这一层落到了缸里面——Provider 塞进 Canvas，或者拿语言给 Canvas 当
   * key——观众点一下语言，鱼就会重新入场、镜头也被拨回默认角度。这条盯的就是这个。
   */
  it('切语言不会把缸重置掉', async () => {
    // Given 观众把镜头转开、等惯性停稳，并记下此刻每条鱼的位置
    const aquarium = await openAquarium()
    await aquarium.dragAcross(-70)
    aquarium.letTimePass(4)
    const cameraBefore = aquarium.camera().position.clone()
    const before = aquarium.fish()

    // When 观众切到英文
    await aquarium.chooseLanguage('en')

    // Then 鱼还是那几条，位置一条都没动
    const after = aquarium.fish()
    expect(after).toHaveLength(before.length)
    expect(after.map(({ position, species }) => ({ position, species }))).toEqual(
      before.map(({ position, species }) => ({ position, species })),
    )

    // 镜头也还在观众留下它的地方
    expect(aquarium.camera().position.distanceTo(cameraBefore)).toBeLessThan(1e-6)

    // 而且鱼接着往下游，不是停在那儿
    aquarium.letTimePass(1)
    expect(aquarium.fish()[0].position).not.toEqual(after[0].position)
  })
})
