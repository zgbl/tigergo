function loadNavbar() {
    const navbar = `
    <div class="container">
      <header>
        <a href="index.html" class="logo">
            <img src="images/BlackRiceLogo25.webp" alt="黑米围棋 Logo" />
        <nav>
          <a href="WeiqiPlay10.html">
            <img src="images/Play.png" class="icon" alt="对弈" /> 对弈
          </a>
          <a href="GameRecord4.html">
            <img src="images/GameRecords.png" class="icon" alt="棋谱" /> 棋谱
          </a>
          <a href="Tournament2.html">
            <img src="images/Match.png" class="icon" alt="比赛" /> 比赛
          </a>
          <a href="News.html">
            <img src="images/News.png" class="icon" alt="新闻" /> 新闻
          </a>
          <a href="Forum11.html">
            <img src="images/Forum.png" class="icon" alt="论坛" /> 论坛
          </a>
          <a href="Register1.html">
            <img src="images/Register.png" class="icon" alt="注册" /> 注册
          </a>
        </nav>
      </header>
    </div>
    `;
    document.getElementById('navbar-placeholder').innerHTML = navbar;
}