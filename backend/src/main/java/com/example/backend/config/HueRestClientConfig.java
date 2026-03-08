package com.example.backend.config;

import javax.net.ssl.SSLContext;
import org.apache.hc.client5.http.classic.HttpClient;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.ssl.NoopHostnameVerifier;
import org.apache.hc.client5.http.ssl.SSLConnectionSocketFactory;
import org.apache.hc.client5.http.ssl.SSLConnectionSocketFactoryBuilder;
import org.apache.hc.core5.ssl.SSLContexts;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class HueRestClientConfig {

    @Bean
    @Qualifier("hueRestClient")
    public RestClient hueRestClient(RestClient.Builder restClientBuilder, HueProperties hueProperties) {
        if (!hueProperties.allowSelfSignedCert()) {
            return restClientBuilder.build();
        }

        try {
            SSLContext sslContext = SSLContexts.custom()
                    .loadTrustMaterial(null, (certChain, authType) -> true)
                    .build();

            SSLConnectionSocketFactory socketFactory = SSLConnectionSocketFactoryBuilder.create()
                    .setSslContext(sslContext)
                    .setHostnameVerifier(NoopHostnameVerifier.INSTANCE)
                    .build();

            HttpClient httpClient = HttpClients.custom()
                    .setConnectionManager(
                            PoolingHttpClientConnectionManagerBuilder.create()
                                    .setSSLSocketFactory(socketFactory)
                                    .build()
                    )
                    .build();

            HttpComponentsClientHttpRequestFactory requestFactory =
                    new HttpComponentsClientHttpRequestFactory(httpClient);

            return restClientBuilder.requestFactory(requestFactory).build();
        } catch (Exception exception) {
            throw new IllegalStateException("Could not configure Hue RestClient SSL settings", exception);
        }
    }
}
