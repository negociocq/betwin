export function socialMetricsState(post,previous={}){
 if(!post.metricsStatus)return {};
 return {metricsStatus:post.metrics?'available':previous.metrics?'stale':'pending_provider',metricsCheckedAt:post.metricsCheckedAt,metricsSourceRefresh:post.metricsSourceRefresh||null,metricsError:null};
}
