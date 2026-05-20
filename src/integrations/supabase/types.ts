export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      analise_rate_limit: {
        Row: {
          created_at: string
          id: string
          periodo: string
          periodo_referencia: string
          ultima_analise: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          periodo: string
          periodo_referencia: string
          ultima_analise?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          periodo?: string
          periodo_referencia?: string
          ultima_analise?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      analises_geradas: {
        Row: {
          created_at: string
          data_referencia: string
          dica_estrategica: string
          id: string
          payload: Json
          periodo: string
          projecao_mes: string
          recomendacoes: string
          resumo_dia: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_referencia: string
          dica_estrategica: string
          id?: string
          payload: Json
          periodo: string
          projecao_mes: string
          recomendacoes: string
          resumo_dia: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_referencia?: string
          dica_estrategica?: string
          id?: string
          payload?: Json
          periodo?: string
          projecao_mes?: string
          recomendacoes?: string
          resumo_dia?: string
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          horas_meta_dia: number | null
          id: string
          km_max_deslocamento: number | null
          km_vazio_max_percent: number | null
          meta_diaria: number | null
          meta_mensal: number | null
          meta_semanal: number | null
          r_km_bom: number | null
          r_km_medio: number | null
          r_por_km_minimo: number | null
          updated_at: string
          user_id: string
          valor_minimo_corrida: number | null
        }
        Insert: {
          horas_meta_dia?: number | null
          id?: string
          km_max_deslocamento?: number | null
          km_vazio_max_percent?: number | null
          meta_diaria?: number | null
          meta_mensal?: number | null
          meta_semanal?: number | null
          r_km_bom?: number | null
          r_km_medio?: number | null
          r_por_km_minimo?: number | null
          updated_at?: string
          user_id: string
          valor_minimo_corrida?: number | null
        }
        Update: {
          horas_meta_dia?: number | null
          id?: string
          km_max_deslocamento?: number | null
          km_vazio_max_percent?: number | null
          meta_diaria?: number | null
          meta_mensal?: number | null
          meta_semanal?: number | null
          r_km_bom?: number | null
          r_km_medio?: number | null
          r_por_km_minimo?: number | null
          updated_at?: string
          user_id?: string
          valor_minimo_corrida?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      jornadas: {
        Row: {
          created_at: string
          data_jornada: string
          duracao_minutos: number | null
          fim: string | null
          id: string
          inicio: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_jornada: string
          duracao_minutos?: number | null
          fim?: string | null
          id?: string
          inicio: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_jornada?: string
          duracao_minutos?: number | null
          fim?: string | null
          id?: string
          inicio?: string
          user_id?: string
        }
        Relationships: []
      }
      rides: {
        Row: {
          bairro_destino: string | null
          bairro_origem: string | null
          classificacao: string | null
          created_at: string
          custo_combustivel_corrida: number | null
          data_corrida: string | null
          duracao_minutos: number | null
          fonte: string | null
          ganho_real_corrida: number | null
          horario_fim: string | null
          horario_inicio: string | null
          id: string
          km_deslocamento: number | null
          km_passageiro: number | null
          km_total: number | null
          observacao: string | null
          origem: string
          plataforma: string
          r_por_km_real: number | null
          rua_destino: string | null
          rua_origem: string | null
          uber_ride_uuid: string | null
          user_id: string
          valor_bruto: number | null
          valor_liquido: number | null
        }
        Insert: {
          bairro_destino?: string | null
          bairro_origem?: string | null
          classificacao?: string | null
          created_at?: string
          custo_combustivel_corrida?: number | null
          data_corrida?: string | null
          duracao_minutos?: number | null
          fonte?: string | null
          ganho_real_corrida?: number | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          km_deslocamento?: number | null
          km_passageiro?: number | null
          km_total?: number | null
          observacao?: string | null
          origem?: string
          plataforma?: string
          r_por_km_real?: number | null
          rua_destino?: string | null
          rua_origem?: string | null
          uber_ride_uuid?: string | null
          user_id: string
          valor_bruto?: number | null
          valor_liquido?: number | null
        }
        Update: {
          bairro_destino?: string | null
          bairro_origem?: string | null
          classificacao?: string | null
          created_at?: string
          custo_combustivel_corrida?: number | null
          data_corrida?: string | null
          duracao_minutos?: number | null
          fonte?: string | null
          ganho_real_corrida?: number | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          km_deslocamento?: number | null
          km_passageiro?: number | null
          km_total?: number | null
          observacao?: string | null
          origem?: string
          plataforma?: string
          r_por_km_real?: number | null
          rua_destino?: string | null
          rua_origem?: string | null
          uber_ride_uuid?: string | null
          user_id?: string
          valor_bruto?: number | null
          valor_liquido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          data_inicio: string
          data_renovacao: string | null
          id: string
          plano: string
          status: string
          user_id: string
          valor: number | null
        }
        Insert: {
          created_at?: string
          data_inicio?: string
          data_renovacao?: string | null
          id?: string
          plano: string
          status: string
          user_id: string
          valor?: number | null
        }
        Update: {
          created_at?: string
          data_inicio?: string
          data_renovacao?: string | null
          id?: string
          plano?: string
          status?: string
          user_id?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      uber_connections: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          status: string
          uber_cookie: string | null
          uber_email: string | null
          ultima_sincronizacao: string | null
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          status?: string
          uber_cookie?: string | null
          uber_email?: string | null
          ultima_sincronizacao?: string | null
          user_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          status?: string
          uber_cookie?: string | null
          uber_email?: string | null
          ultima_sincronizacao?: string | null
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          aceite_privacidade: boolean
          aceite_privacidade_em: string | null
          ano_nascimento: number | null
          ativo: boolean
          cidade: string | null
          created_at: string
          email: string
          estado: string | null
          id: string
          is_admin: boolean
          mp_subscription_id: string | null
          nome: string | null
          plano: string
          sexo: string | null
          telefone: string | null
          telefone_verificado: boolean
          trial_expira_em: string | null
          uber_conectado: boolean
          uber_cookie: string | null
          uber_csrf_token: string | null
          uber_earnings_seed: string | null
          uber_ultimo_sync: string | null
        }
        Insert: {
          aceite_privacidade?: boolean
          aceite_privacidade_em?: string | null
          ano_nascimento?: number | null
          ativo?: boolean
          cidade?: string | null
          created_at?: string
          email: string
          estado?: string | null
          id: string
          is_admin?: boolean
          mp_subscription_id?: string | null
          nome?: string | null
          plano?: string
          sexo?: string | null
          telefone?: string | null
          telefone_verificado?: boolean
          trial_expira_em?: string | null
          uber_conectado?: boolean
          uber_cookie?: string | null
          uber_csrf_token?: string | null
          uber_earnings_seed?: string | null
          uber_ultimo_sync?: string | null
        }
        Update: {
          aceite_privacidade?: boolean
          aceite_privacidade_em?: string | null
          ano_nascimento?: number | null
          ativo?: boolean
          cidade?: string | null
          created_at?: string
          email?: string
          estado?: string | null
          id?: string
          is_admin?: boolean
          mp_subscription_id?: string | null
          nome?: string | null
          plano?: string
          sexo?: string | null
          telefone?: string | null
          telefone_verificado?: boolean
          trial_expira_em?: string | null
          uber_conectado?: boolean
          uber_cookie?: string | null
          uber_csrf_token?: string | null
          uber_earnings_seed?: string | null
          uber_ultimo_sync?: string | null
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          ano: number | null
          capacidade_tanque: number | null
          combustivel: string | null
          consumo_alcool: number | null
          consumo_gasolina: number | null
          consumo_gasolina_reserva: number | null
          consumo_km_kwh: number | null
          consumo_km_litro: number | null
          created_at: string
          custo_ipva_mensal: number | null
          custo_lavagem_mensal: number | null
          custo_manutencao_mensal: number | null
          custo_seguro_mensal: number | null
          dias_trabalhados_mes: number
          id: string
          marca: string | null
          modelo: string | null
          outros_custos_label: string | null
          outros_custos_valor: number | null
          percentual_celular_trabalho: number | null
          placa: string | null
          preco_alcool: number | null
          preco_combustivel: number | null
          preco_gasolina: number | null
          preco_gasolina_reserva: number | null
          preco_kwh: number | null
          taxa_uber_percent: number
          tipo_posse: string | null
          user_id: string
          valor_parcela_ou_diaria: number | null
          valor_plano_celular: number | null
        }
        Insert: {
          ano?: number | null
          capacidade_tanque?: number | null
          combustivel?: string | null
          consumo_alcool?: number | null
          consumo_gasolina?: number | null
          consumo_gasolina_reserva?: number | null
          consumo_km_kwh?: number | null
          consumo_km_litro?: number | null
          created_at?: string
          custo_ipva_mensal?: number | null
          custo_lavagem_mensal?: number | null
          custo_manutencao_mensal?: number | null
          custo_seguro_mensal?: number | null
          dias_trabalhados_mes?: number
          id?: string
          marca?: string | null
          modelo?: string | null
          outros_custos_label?: string | null
          outros_custos_valor?: number | null
          percentual_celular_trabalho?: number | null
          placa?: string | null
          preco_alcool?: number | null
          preco_combustivel?: number | null
          preco_gasolina?: number | null
          preco_gasolina_reserva?: number | null
          preco_kwh?: number | null
          taxa_uber_percent?: number
          tipo_posse?: string | null
          user_id: string
          valor_parcela_ou_diaria?: number | null
          valor_plano_celular?: number | null
        }
        Update: {
          ano?: number | null
          capacidade_tanque?: number | null
          combustivel?: string | null
          consumo_alcool?: number | null
          consumo_gasolina?: number | null
          consumo_gasolina_reserva?: number | null
          consumo_km_kwh?: number | null
          consumo_km_litro?: number | null
          created_at?: string
          custo_ipva_mensal?: number | null
          custo_lavagem_mensal?: number | null
          custo_manutencao_mensal?: number | null
          custo_seguro_mensal?: number | null
          dias_trabalhados_mes?: number
          id?: string
          marca?: string | null
          modelo?: string | null
          outros_custos_label?: string | null
          outros_custos_valor?: number | null
          percentual_celular_trabalho?: number | null
          placa?: string | null
          preco_alcool?: number | null
          preco_combustivel?: number | null
          preco_gasolina?: number | null
          preco_gasolina_reserva?: number | null
          preco_kwh?: number | null
          taxa_uber_percent?: number
          tipo_posse?: string | null
          user_id?: string
          valor_parcela_ou_diaria?: number | null
          valor_plano_celular?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_users: {
        Args: never
        Returns: {
          aceite_privacidade: boolean
          aceite_privacidade_em: string | null
          ano_nascimento: number | null
          ativo: boolean
          cidade: string | null
          created_at: string
          email: string
          estado: string | null
          id: string
          is_admin: boolean
          mp_subscription_id: string | null
          nome: string | null
          plano: string
          sexo: string | null
          telefone: string | null
          telefone_verificado: boolean
          trial_expira_em: string | null
          uber_conectado: boolean
          uber_cookie: string | null
          uber_csrf_token: string | null
          uber_earnings_seed: string | null
          uber_ultimo_sync: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "users"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_update_user_plan: {
        Args: {
          new_plano: string
          new_trial_expiry?: string
          target_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
