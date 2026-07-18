// 歌词搜索
module.exports = (params, useAxios) => {
  const dataMap = {
    ver: 1,
    man: params.man ?? 'yes',
    client: 'pc',
    hash: params?.hash || '',
    keyword: params?.keywords || '',
    duration: params?.duration || 0,
  };

  return useAxios({
    baseURL: 'https://lyrics.kugou.com',
    url: '/search',
    method: 'GET',
    params: dataMap,
    cookie: params?.cookie || {},
    encryptType: 'android',
    clearDefaultParams: true,
    notSign: true,
  });
};
