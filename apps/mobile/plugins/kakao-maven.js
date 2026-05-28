const { withProjectBuildGradle } = require('expo/config-plugins')

module.exports = function kakaoMavenPlugin(config) {
  return withProjectBuildGradle(config, (cfg) => {
    const contents = cfg.modResults.contents
    const repo = "maven { url 'https://devrepo.kakao.com/nexus/content/groups/public/' }"
    if (!contents.includes('devrepo.kakao.com')) {
      cfg.modResults.contents = contents.replace(
        "maven { url 'https://www.jitpack.io' }",
        `maven { url 'https://www.jitpack.io' }\n    ${repo}`,
      )
    }
    return cfg
  })
}
